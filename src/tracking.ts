import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { Hand, Point } from "./controls";
import { HandIdentity } from "./hand-identity";
type TrackingModel = {
  detectForVideo(
    video: HTMLVideoElement,
    time: number,
  ):
    | {
        landmarks: Point[][];
        handedness: { categoryName: string; score: number }[][];
      }
    | Promise<{
        landmarks: Point[][];
        handedness: { categoryName: string; score: number }[][];
      }>;
  close(): void;
};
type VisionFiles = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
export class Tracker {
  private model?: TrackingModel;
  private abort = new AbortController();
  private files?: VisionFiles;
  private stream?: MediaStream;
  private raf = 0;
  private lastFrame = -1;
  private lastInference = -Infinity;
  private lastVideoAt = 0;
  private running = false;
  private recovering = false;
  private delegate: "GPU" | "CPU" | "WASM" = "GPU";
  private session = 0;
  private cameraRetries = 0;
  private healthyFrames = 0;
  private identity = new HandIdentity();
  constructor(
    private video: HTMLVideoElement,
    private onFrame: (hands: Hand[], time: number) => void,
    private onError: (message: string) => void,
    private onStatus: (message: string) => void = () => {},
  ) {}
  get cameraActive() {
    return !!this.stream?.getTracks().some((t) => t.readyState !== "ended");
  }
  private async capture() {
    const signal = this.abort.signal;
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24, max: 30 },
          facingMode: "user",
        },
        audio: false,
      });
    } catch (error) {
      if (signal.aborted)
        throw new DOMException("Conexão cancelada", "AbortError");
      if (
        !(error instanceof DOMException) ||
        error.name !== "OverconstrainedError"
      )
        throw error;
      return navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
    }
  }
  private waitFor<T>(
    promise: Promise<T>,
    ms: number,
    message: string,
    dispose?: (value: T) => void,
  ): Promise<T> {
    const signal = this.abort.signal;
    return new Promise((resolve, reject) => {
      let ended = false;
      const finish = () => {
        ended = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", cancel);
      };
      const cancel = () => {
        if (!ended) {
          finish();
          reject(new DOMException("Conexão cancelada", "AbortError"));
        }
      };
      const timer = setTimeout(() => {
        if (!ended) {
          finish();
          reject(new Error(message));
        }
      }, ms);
      signal.addEventListener("abort", cancel, { once: true });
      promise.then(
        (value) => {
          if (ended) {
            dispose?.(value);
            return;
          }
          finish();
          resolve(value);
        },
        (error) => {
          if (!ended) {
            finish();
            reject(error);
          }
        },
      );
      if (signal.aborted) cancel();
    });
  }
  private closeModel(model = this.model) {
    try {
      model?.close();
    } catch {
      /* A lost graphics context can also reject disposal. */
    }
  }
  private createModel(delegate: "GPU" | "CPU") {
    return this.waitFor(
      HandLandmarker.createFromOptions(this.files!, {
        baseOptions: {
          modelAssetPath: `${import.meta.env.BASE_URL}models/hand_landmarker.task`,
          delegate,
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.35,
        minHandPresenceConfidence: 0.35,
        minTrackingConfidence: 0.4,
      }),
      20000,
      "O reconhecimento demorou a carregar. Tente uma conexão mais rápida ou o modo compatível.",
      (model) => this.closeModel(model),
    );
  }
  private async fallback(previous: "GPU" | "CPU") {
    const session = this.session;
    if (previous === "GPU") {
      try {
        return {
          model: await this.createModel("CPU"),
          delegate: "CPU" as const,
        };
      } catch (error) {
        if (session !== this.session) throw error;
      }
    }
    if (session !== this.session)
      throw new DOMException("Conexão cancelada", "AbortError");
    this.onStatus("Carregando modo compatível sem WebGL…");
    const model = await this.waitFor(
      import("./cpu-tracking").then((m) => m.createCpuTracking()),
      45000,
      "Não foi possível carregar o modo compatível. Verifique a conexão e tente novamente.",
      (model) => this.closeModel(model),
    );
    if (session !== this.session) {
      this.closeModel(model);
      throw new DOMException("Conexão cancelada", "AbortError");
    }
    return { model, delegate: "WASM" as const };
  }
  async start(compatible = false): Promise<boolean> {
    this.stop();
    const session = this.session;
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error(
        "A webcam precisa de HTTPS ou localhost e de um navegador compatível.",
      );
    try {
      this.onStatus("Aguardando permissão da câmera…");
      const stream = await this.waitFor(
        this.capture(),
        30000,
        "A câmera não respondeu. Abra este site no Chrome ou Safari, autorize a câmera e tente novamente.",
        (stream) => stream.getTracks().forEach((t) => t.stop()),
      );
      if (session !== this.session) {
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }
      this.stream = stream;
      this.video.muted = true;
      this.video.playsInline = true;
      this.video.autoplay = true;
      this.video.srcObject = stream;
      this.onStatus("Abrindo vídeo da câmera…");
      await this.waitFor(
        this.video.play(),
        10000,
        "O vídeo da câmera não iniciou. Toque em tentar novamente e feche outros aplicativos que usam a câmera.",
      );
      this.onStatus("Vídeo ativo · carregando reconhecimento…");
      let model: TrackingModel;
      if (compatible) {
        const next = await this.fallback("CPU");
        model = next.model;
        this.delegate = next.delegate;
      } else {
        this.files = await this.waitFor(
          FilesetResolver.forVisionTasks(
            `${import.meta.env.BASE_URL}vendor/mediapipe`,
          ),
          30000,
          "Não foi possível carregar o reconhecimento. Verifique a conexão e tente novamente.",
        );
        if (session !== this.session) return false;
        this.delegate = "GPU";
        try {
          model = await this.createModel("GPU");
        } catch {
          if (session !== this.session) return false;
          const next = await this.fallback("GPU");
          this.delegate = next.delegate;
          model = next.model;
        }
      }
      if (session !== this.session) {
        this.closeModel(model);
        return false;
      }
      this.model = model;
      this.running = true;
      this.lastVideoAt = performance.now();
      if (typeof document !== "undefined")
        document.addEventListener("visibilitychange", this.visibility);
      this.raf = requestAnimationFrame(this.tick);
      return true;
    } catch (e) {
      if (session !== this.session) return false;
      this.stop();
      throw e;
    }
  }
  private visibility = () => {
    if (!this.running) return;
    this.lastVideoAt = performance.now();
    this.lastFrame = -1;
    this.identity.reset();
    this.onFrame([], this.lastVideoAt);
    if (!document.hidden)
      void this.video.play().catch(() => this.recoverCamera());
  };
  private tick = async () => {
    const session = this.session;
    if (!this.running || !this.model || this.recovering) return;
    const now = performance.now();
    if (typeof document !== "undefined" && document.hidden) {
      this.raf = requestAnimationFrame(this.tick);
      return;
    }
    try {
      if (
        this.video.readyState >= 2 &&
        this.video.currentTime !== this.lastFrame &&
        now - this.lastInference >= 50
      ) {
        this.lastFrame = this.video.currentTime;
        this.lastVideoAt = now;
        this.lastInference = now;
        const result = this.model.detectForVideo(this.video, now);
        const r = result instanceof Promise ? await result : result;
        if (session !== this.session || !this.running) return;
        const detected: Hand[] = r.landmarks.map((points, i) => ({
          points,
          side:
            r.handedness[i]?.[0]?.categoryName === "Left" ? "Left" : "Right",
          score: r.handedness[i]?.[0]?.score ?? 0,
        }));
        this.onFrame(this.identity.update(detected, now), now);
        if (++this.healthyFrames >= 10) this.cameraRetries = 0;
      } else if (now - this.lastVideoAt > 2500) {
        void this.recoverCamera();
        return;
      }
    } catch {
      if (session !== this.session) return;
      void this.recoverModel();
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  };
  private async recoverModel() {
    if (this.recovering || !this.running) return;
    if (this.delegate === "WASM") {
      this.fail(
        "O reconhecimento parou, mas a prévia continua aberta. Tente reconectar ou use os controles de toque.",
      );
      return;
    }
    const session = this.session;
    this.recovering = true;
    this.onFrame([], performance.now());
    this.onStatus("Recuperando reconhecimento…");
    try {
      this.closeModel();
      this.model = undefined;
      const next = await this.fallback(this.delegate as "GPU" | "CPU");
      if (session !== this.session) {
        this.closeModel(next.model);
        return;
      }
      this.model = next.model;
      this.delegate = next.delegate;
      this.lastFrame = -1;
      this.lastVideoAt = performance.now();
      this.identity.reset();
      this.recovering = false;
      this.raf = requestAnimationFrame(this.tick);
    } catch {
      if (session === this.session)
        this.fail(
          "Não foi possível recuperar o reconhecimento. O vídeo continua aberto; tente novamente ou jogue por toque.",
        );
    }
  }
  private async recoverCamera() {
    if (this.recovering || !this.running) return;
    if (this.cameraRetries >= 2) {
      this.fail(
        "A câmera foi interrompida pelo navegador. Toque em tentar novamente para reconectar.",
      );
      return;
    }
    const session = this.session;
    this.recovering = true;
    this.cameraRetries++;
    this.healthyFrames = 0;
    this.onFrame([], performance.now());
    this.onStatus("Reconectando câmera…");
    try {
      let stream: MediaStream;
      try {
        stream = await this.waitFor(
          this.capture(),
          15000,
          "A câmera não respondeu à reconexão.",
          (stream) => stream.getTracks().forEach((t) => t.stop()),
        );
      } catch (error) {
        if (session !== this.session) return;
        if (
          !(error instanceof DOMException) ||
          !["NotReadableError", "AbortError"].includes(error.name)
        )
          throw error;
        this.stream?.getTracks().forEach((t) => t.stop());
        this.stream = undefined;
        this.video.srcObject = null;
        stream = await this.waitFor(
          this.capture(),
          15000,
          "A câmera não respondeu à reconexão.",
          (stream) => stream.getTracks().forEach((t) => t.stop()),
        );
      }
      if (session !== this.session) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream?.getTracks().forEach((t) => t.stop());
      this.stream = stream;
      this.video.srcObject = stream;
      await this.waitFor(
        this.video.play(),
        10000,
        "O vídeo da câmera não iniciou. Toque em tentar novamente e feche outros aplicativos que usam a câmera.",
      );
      if (session !== this.session) return;
      this.lastFrame = -1;
      this.lastVideoAt = performance.now();
      this.identity.reset();
      this.recovering = false;
      this.raf = requestAnimationFrame(this.tick);
    } catch {
      if (session === this.session)
        this.fail(
          "O navegador interrompeu a câmera. Verifique a permissão e toque em tentar novamente.",
        );
    }
  }
  private fail(message: string) {
    // An inference failure must not disconnect a still-working camera preview.
    this.running = false;
    this.recovering = false;
    cancelAnimationFrame(this.raf);
    this.onFrame([], performance.now());
    this.onError(message);
  }
  stop() {
    this.session++;
    this.abort.abort();
    this.abort = new AbortController();
    this.running = false;
    this.recovering = false;
    if (typeof document !== "undefined")
      document.removeEventListener("visibilitychange", this.visibility);
    this.identity.reset();
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.closeModel();
    this.model = undefined;
    this.video.srcObject = null;
    this.lastFrame = -1;
    this.lastInference = -Infinity;
    this.cameraRetries = 0;
    this.healthyFrames = 0;
  }
}
