import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { Hand } from "./controls";
import { HandIdentity } from "./hand-identity";
export class Tracker {
  private model?: HandLandmarker;
  private stream?: MediaStream;
  private raf = 0;
  private lastFrame = -1;
  private running = false;
  private identity = new HandIdentity();
  constructor(
    private video: HTMLVideoElement,
    private onFrame: (hands: Hand[], time: number) => void,
    private onError: (message: string) => void,
  ) {}
  async start() {
    this.stop();
    this.lastFrame = -1;
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error(
        "A webcam precisa de HTTPS ou localhost e de um navegador compatível.",
      );
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 960 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: "user",
        },
        audio: false,
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      const files = await FilesetResolver.forVisionTasks(
        `${import.meta.env.BASE_URL}vendor/mediapipe`,
      );
      const options = {
        baseOptions: {
          modelAssetPath: `${import.meta.env.BASE_URL}models/hand_landmarker.task`,
        },
        runningMode: "VIDEO" as const,
        numHands: 2,
        minHandDetectionConfidence: 0.35,
        minHandPresenceConfidence: 0.35,
        minTrackingConfidence: 0.4,
      };
      // GPU keeps inference from blocking the game on supported devices.
      // CPU remains available for browsers without a compatible WebGL context.
      try {
        this.model = await HandLandmarker.createFromOptions(files, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: "GPU" },
        });
      } catch {
        this.model = await HandLandmarker.createFromOptions(files, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: "CPU" },
        });
      }
      this.running = true;
      this.tick();
    } catch (e) {
      this.stop();
      throw e;
    }
  }
  private tick = () => {
    if (!this.running || !this.model) return;
    try {
      if (
        this.video.readyState >= 2 &&
        this.video.currentTime !== this.lastFrame
      ) {
        this.lastFrame = this.video.currentTime;
        const now = performance.now();
        const r = this.model.detectForVideo(this.video, now);
        // Tasks Vision reports anatomical handedness. Mirroring belongs only
        // to the preview and movement coordinates, never to these labels.
        const detected: Hand[] = r.landmarks.map((points, i) => ({
          points,
          side:
            r.handedness[i]?.[0]?.categoryName === "Left" ? "Left" : "Right",
          score: r.handedness[i]?.[0]?.score ?? 0,
        }));
        const hands = this.identity.update(detected, now);
        this.onFrame(hands, now);
      }
    } catch (e) {
      this.stop();
      this.onError(e instanceof Error ? e.message : "Falha no rastreamento.");
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  };
  stop() {
    this.running = false;
    this.identity.reset();
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.model?.close();
    this.model = undefined;
    this.video.srcObject = null;
  }
}
