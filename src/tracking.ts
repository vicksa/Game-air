import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { Hand } from "./controls";
import { HandIdentity } from "./hand-identity";
type VisionFiles = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
export class Tracker {
  private model?: HandLandmarker;
  private files?: VisionFiles;
  private stream?: MediaStream;
  private raf = 0;
  private lastFrame = -1;
  private lastInference = -Infinity;
  private lastVideoAt = 0;
  private running = false;
  private recovering = false;
  private delegate: "GPU" | "CPU" = "GPU";
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
  private capture() {
    return navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 24, max: 30 },
        facingMode: "user",
      },
      audio: false,
    });
  }
  private createModel(delegate: "GPU" | "CPU") {
    return HandLandmarker.createFromOptions(this.files!, {
      baseOptions: {
        modelAssetPath: `${import.meta.env.BASE_URL}models/hand_landmarker.task`,
        delegate,
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.35,
      minHandPresenceConfidence: 0.35,
      minTrackingConfidence: 0.4,
    });
  }
  async start(): Promise<boolean> {
    this.stop();
    const session = this.session;
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error(
        "A webcam precisa de HTTPS ou localhost e de um navegador compatível.",
      );
    try {
      const stream = await this.capture();
      if (session !== this.session) {
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }
      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play();
      this.files = await FilesetResolver.forVisionTasks(
        `${import.meta.env.BASE_URL}vendor/mediapipe`,
      );
      if (session !== this.session) return false;
      this.delegate = "GPU";
      let model: HandLandmarker;
      try {
        model = await this.createModel("GPU");
      } catch {
        if (session !== this.session) return false;
        this.delegate = "CPU";
        model = await this.createModel("CPU");
      }
      if (session !== this.session) {
        model.close();
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
      if (session === this.session) this.stop();
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
  private tick = () => {
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
        const r = this.model.detectForVideo(this.video, now);
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
      void this.recoverModel();
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  };
  private async recoverModel() {
    if (this.recovering || !this.running) return;
    if (this.delegate === "CPU") {
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
      this.model?.close();
      this.model = undefined;
      const model = await this.createModel("CPU");
      if (session !== this.session) {
        model.close();
        return;
      }
      this.model = model;
      this.delegate = "CPU";
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
      const stream = await this.capture();
      if (session !== this.session) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream?.getTracks().forEach((t) => t.stop());
      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play();
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
    this.running = false;
    this.recovering = false;
    if (typeof document !== "undefined")
      document.removeEventListener("visibilitychange", this.visibility);
    this.identity.reset();
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.model?.close();
    this.model = undefined;
    this.video.srcObject = null;
    this.lastFrame = -1;
    this.lastInference = -Infinity;
    this.cameraRetries = 0;
    this.healthyFrames = 0;
  }
}
