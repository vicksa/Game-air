import * as tf from "@tensorflow/tfjs-core";
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm";
import {
  createDetector,
  SupportedModels,
} from "@tensorflow-models/hand-pose-detection";
import type { Point } from "./controls";

// A separate WASM backend: unlike Tasks Vision's CPU delegate, it does not
// require a WebGL context to upload video frames.
export async function createCpuTracking() {
  setWasmPaths(`${import.meta.env.BASE_URL}vendor/tfjs/`);
  await tf.setBackend("wasm");
  await tf.ready();
  const detector = await createDetector(SupportedModels.MediaPipeHands, {
    runtime: "tfjs",
    modelType: "lite",
    maxHands: 2,
    detectorModelUrl: `${import.meta.env.BASE_URL}models/tfjs/detector/model.json`,
    landmarkModelUrl: `${import.meta.env.BASE_URL}models/tfjs/landmark/model.json`,
  });
  return {
    async detectForVideo(video: HTMLVideoElement) {
      // The detector reads HTMLVideoElement.width/height, which can be zero
      // even when videoWidth/videoHeight are valid. A pixel tensor carries the
      // actual frame dimensions and avoids invalid hand crop coordinates.
      const frame = tf.browser.fromPixels(video);
      let hands;
      try {
        hands = await detector.estimateHands(frame, {
          flipHorizontal: false,
          staticImageMode: false,
        });
      } finally {
        frame.dispose();
      }
      const landmarks: Point[][] = hands.map((h) =>
        h.keypoints.map((p) => ({
          x: p.x / video.videoWidth,
          y: p.y / video.videoHeight,
        })),
      );
      return {
        landmarks,
        handedness: hands.map((h) => [
          { categoryName: h.handedness, score: h.score },
        ]),
      };
    },
    close() {
      detector.dispose();
    },
  };
}
