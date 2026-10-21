import { afterEach, expect, it, vi } from "vitest";
const { create, detect, close } = vi.hoisted(() => ({
  create: vi.fn(),
  detect: vi.fn(),
  close: vi.fn(),
}));
vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: vi.fn().mockResolvedValue({}) },
  HandLandmarker: { createFromOptions: create },
}));
import { Tracker } from "../src/tracking";
import { HandIdentity } from "../src/hand-identity";
import type { Hand } from "../src/controls";
const hand = (side: Hand["side"], x: number): Hand => ({
  side,
  score: 0.2,
  points: Array.from({ length: 21 }, () => ({ x, y: 0.5 })),
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("preserves anatomical labels through classifier flips and result reordering", () => {
  const identity = new HandIdentity();
  identity.update([hand("Left", 0.7), hand("Right", 0.3)], 0);
  const pair = identity.update([hand("Left", 0.31), hand("Right", 0.69)], 33);
  expect(pair.map((h) => h.side)).toEqual(["Right", "Left"]);
  expect(identity.update([hand("Right", 0.68)], 66)[0].side).toBe("Left");
});
it("does not invent missing hands, expires identity and resets between sessions", () => {
  const identity = new HandIdentity();
  identity.update([hand("Left", 0.7), hand("Right", 0.3)], 0);
  expect(identity.update([], 30)).toEqual([]);
  expect(identity.update([hand("Right", 0.69)], 80)[0].side).toBe("Left");
  expect(identity.update([hand("Right", 0.69)], 500)[0].side).toBe("Right");
  identity.reset();
  expect(identity.update([hand("Left", 0.69)], 510)[0].side).toBe("Left");
});
it("keeps existing identity when an ambiguously labelled second hand returns", () => {
  const identity = new HandIdentity();
  identity.update([hand("Right", 0.3)], 0);
  const pair = identity.update([hand("Right", 0.31), hand("Right", 0.7)], 30);
  expect(pair.find((h) => h.points[9].x === 0.31)?.side).toBe("Right");
  expect(pair.find((h) => h.points[9].x === 0.7)?.side).toBe("Left");
});
it("passes anatomical labels unchanged, uses GPU with CPU fallback, and releases camera", async () => {
  const stop = vi.fn();
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }),
    },
  });
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const pair = [hand("Left", 0.7), hand("Right", 0.3)];
  detect.mockReturnValue({
    landmarks: pair.map((h) => h.points),
    handedness: pair.map((h) => [{ categoryName: h.side, score: h.score }]),
  });
  create
    .mockRejectedValueOnce(new Error("GPU unavailable"))
    .mockResolvedValueOnce({ detectForVideo: detect, close });
  const video = {
    srcObject: null,
    play: vi.fn(),
    readyState: 2,
    currentTime: 1,
  } as unknown as HTMLVideoElement;
  const onFrame = vi.fn();
  const tracker = new Tracker(video, onFrame, vi.fn());
  await tracker.start();
  expect(create.mock.calls.map((c) => c[1].baseOptions.delegate)).toEqual([
    "GPU",
    "CPU",
  ]);
  expect(create.mock.calls[1][1]).toMatchObject({
    numHands: 2,
    minHandPresenceConfidence: 0.35,
    minHandDetectionConfidence: 0.35,
    minTrackingConfidence: 0.4,
  });
  expect(onFrame.mock.calls[0][0].map((h: Hand) => h.side)).toEqual([
    "Left",
    "Right",
  ]);
  tracker.stop();
  expect(stop).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
  expect(video.srcObject).toBeNull();
});
