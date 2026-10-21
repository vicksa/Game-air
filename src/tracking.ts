import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { Hand } from "./controls";
export class Tracker {
  private model?: HandLandmarker;
  private stream?: MediaStream;
  private raf = 0;
  private lastFrame = -1;
  private running = false;
  constructor(
    private video: HTMLVideoElement,
    private onFrame: (hands: Hand[], time: number) => void,
    private onError: (message: string) => void,
  ) {}
  async start() {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error(
        "A webcam precisa de HTTPS ou localhost e de um navegador compatível.",
      );
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      const files = await FilesetResolver.forVisionTasks(
        `${import.meta.env.BASE_URL}vendor/mediapipe`,
      );
      this.model = await HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: `${import.meta.env.BASE_URL}models/hand_landmarker.task`,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
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
        // MediaPipe assumes selfie input, but receives the unmirrored video here.
        const hands: Hand[] = r.landmarks.map((points, i) => ({
          points,
          side: r.handedness[i][0].categoryName === "Left" ? "Right" : "Left",
          score: r.handedness[i][0].score,
        }));
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
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.model?.close();
    this.model = undefined;
    this.video.srcObject = null;
  }
}
