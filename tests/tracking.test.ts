import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { create, detect, close, cpu } = vi.hoisted(() => ({
  create: vi.fn(),
  detect: vi.fn(),
  close: vi.fn(),
  cpu: vi.fn(),
}));
vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: vi.fn().mockResolvedValue({}) },
  HandLandmarker: { createFromOptions: create },
}));
vi.mock("../src/cpu-tracking", () => ({ createCpuTracking: cpu }));
beforeEach(() => {
  cpu.mockRejectedValue(new Error("compatibility unavailable"));
});
import { Tracker } from "../src/tracking";
import { HandIdentity } from "../src/hand-identity";
import type { Hand } from "../src/controls";
const hand = (side: Hand["side"], x: number): Hand => ({
  side,
  score: 0.2,
  points: Array.from({ length: 21 }, () => ({ x, y: 0.5 })),
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.restoreAllMocks();
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
    play: vi.fn().mockResolvedValue(undefined),
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
  vi.mocked(requestAnimationFrame).mock.calls.at(-1)![0](performance.now());
  expect(onFrame.mock.calls[0][0].map((h: Hand) => h.side)).toEqual([
    "Left",
    "Right",
  ]);
  tracker.stop();
  expect(stop).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
  expect(video.srcObject).toBeNull();
});

function setupRuntime() {
  let time = 0;
  vi.spyOn(performance, "now").mockImplementation(() => time);
  const oldStop = vi.fn(),
    newStop = vi.fn();
  const oldStream = {
    getTracks: () => [{ stop: oldStop, readyState: "live" }],
  };
  const newStream = {
    getTracks: () => [{ stop: newStop, readyState: "live" }],
  };
  const capture = vi
    .fn()
    .mockResolvedValueOnce(oldStream)
    .mockResolvedValue(newStream);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: capture } });
  let next: FrameRequestCallback;
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((cb: FrameRequestCallback) => {
      next = cb;
      return 1;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const video = {
    srcObject: null,
    play: vi.fn().mockResolvedValue(undefined),
    readyState: 2,
    currentTime: 1,
  } as unknown as HTMLVideoElement;
  const frame = vi.fn(),
    error = vi.fn();
  const tracker = new Tracker(video, frame, error);
  const step = (at: number, videoTime = video.currentTime) => {
    time = at;
    video.currentTime = videoTime;
    next(at);
  };
  return {
    tracker,
    video,
    frame,
    error,
    oldStop,
    newStop,
    oldStream,
    newStream,
    capture,
    step,
  };
}
it("recovers a runtime GPU failure on CPU without stopping the camera", async () => {
  const env = setupRuntime();
  const cpuDetect = vi.fn().mockReturnValue({ landmarks: [], handedness: [] });
  create
    .mockResolvedValueOnce({
      detectForVideo: () => {
        throw new Error("WebGL context lost");
      },
      close,
    })
    .mockResolvedValueOnce({ detectForVideo: cpuDetect, close: vi.fn() });
  await env.tracker.start();
  env.step(0);
  await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => expect((env.tracker as any).recovering).toBe(false));
  env.step(100, 2);
  expect(cpuDetect).toHaveBeenCalledOnce();
  expect(env.oldStop).not.toHaveBeenCalled();
  expect(env.video.srcObject).toBe(env.oldStream);
  expect(env.error).not.toHaveBeenCalled();
  env.tracker.stop();
});
it("keeps the preview alive when inference is unrecoverable and emits no stale hand commands", async () => {
  const env = setupRuntime();
  const broken = () => {
    throw new Error("inference failed");
  };
  create.mockResolvedValue({ detectForVideo: broken, close });
  await env.tracker.start();
  env.step(0);
  await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => expect((env.tracker as any).recovering).toBe(false));
  env.step(100, 2);
  await vi.waitFor(() => expect(env.error).toHaveBeenCalledOnce());
  expect(env.frame).toHaveBeenLastCalledWith([], 100);
  expect(env.oldStop).not.toHaveBeenCalled();
  expect(env.video.srcObject).toBe(env.oldStream);
  env.tracker.stop();
});
it("reacquires a stalled video stream instead of silently losing the preview", async () => {
  const env = setupRuntime();
  create.mockResolvedValue({
    detectForVideo: () => ({ landmarks: [], handedness: [] }),
    close,
  });
  await env.tracker.start();
  env.step(0);
  env.step(2600);
  await vi.waitFor(() => expect(env.video.play).toHaveBeenCalledTimes(2));
  expect(env.video.srcObject).toBe(env.newStream);
  expect(env.oldStop).toHaveBeenCalledOnce();
  env.step(2700, 2);
  expect(env.error).not.toHaveBeenCalled();
  env.tracker.stop();
  expect(env.newStop).toHaveBeenCalledOnce();
});
it("cancels a pending model initialization without reopening a stopped session", async () => {
  const env = setupRuntime();
  let complete!: (model: any) => void;
  create.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const starting = env.tracker.start();
  await vi.waitFor(() => expect(create).toHaveBeenCalledOnce());
  env.tracker.stop();
  const lateClose = vi.fn();
  complete({ detectForVideo: detect, close: lateClose });
  expect(await starting).toBe(false);
  expect(lateClose).toHaveBeenCalledOnce();
  expect(env.video.srcObject).toBeNull();
});

it("suspends inference in the background and resumes video after returning", async () => {
  const env = setupRuntime();
  const events = new EventTarget();
  const doc = Object.assign(events, { hidden: false });
  vi.stubGlobal("document", doc);
  const infer = vi.fn().mockReturnValue({ landmarks: [], handedness: [] });
  create.mockResolvedValue({ detectForVideo: infer, close });
  await env.tracker.start();
  env.step(0);
  doc.hidden = true;
  doc.dispatchEvent(new Event("visibilitychange"));
  env.step(3000, 2);
  expect(infer).toHaveBeenCalledOnce();
  doc.hidden = false;
  doc.dispatchEvent(new Event("visibilitychange"));
  await Promise.resolve();
  env.step(3100, 3);
  expect(env.video.play).toHaveBeenCalledTimes(2);
  expect(infer).toHaveBeenCalledTimes(2);
  expect(env.capture).toHaveBeenCalledOnce();
  env.tracker.stop();
});

it("uses a genuinely WebGL-free WASM backend when both native delegates fail", async () => {
  const env = setupRuntime();
  const infer = vi.fn().mockResolvedValue({ landmarks: [], handedness: [] });
  create.mockRejectedValue(new Error("WebGL unavailable"));
  cpu.mockResolvedValueOnce({ detectForVideo: infer, close: vi.fn() });
  expect(await env.tracker.start()).toBe(true);
  env.step(0);
  await vi.waitFor(() => expect(env.frame).toHaveBeenCalledOnce());
  expect(infer).toHaveBeenCalledOnce();
  expect(env.video.srcObject).toBe(env.oldStream);
  env.tracker.stop();
});
it("releases an exclusive camera before retrying a rejected reconnection", async () => {
  const env = setupRuntime();
  create.mockResolvedValue({
    detectForVideo: () => ({ landmarks: [], handedness: [] }),
    close,
  });
  await env.tracker.start();
  env.step(0);
  env.capture.mockRejectedValueOnce(
    new DOMException("device in use", "NotReadableError"),
  );
  env.step(2600);
  await vi.waitFor(() => expect(env.video.srcObject).toBe(env.newStream));
  expect(env.capture).toHaveBeenCalledTimes(3);
  expect(env.oldStop).toHaveBeenCalledOnce();
  env.tracker.stop();
});
it("retries unsupported capture constraints with browser defaults", async () => {
  const env = setupRuntime();
  env.capture
    .mockReset()
    .mockRejectedValueOnce(
      new DOMException("fps unsupported", "OverconstrainedError"),
    )
    .mockResolvedValueOnce(env.oldStream);
  create.mockResolvedValue({ detectForVideo: detect, close });
  await env.tracker.start();
  expect(env.capture.mock.calls[1][0]).toEqual({
    video: { facingMode: "user" },
    audio: false,
  });
  expect(env.video.muted).toBe(true);
  expect(env.video.playsInline).toBe(true);
  env.tracker.stop();
});
it("cancels pending permission requests and stops streams arriving afterward", async () => {
  const env = setupRuntime();
  let grant!: (stream: any) => void;
  env.capture.mockReset().mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        grant = resolve;
      }),
  );
  const starting = env.tracker.start();
  env.tracker.stop();
  expect(await starting).toBe(false);
  grant(env.oldStream);
  await vi.waitFor(() => expect(env.oldStop).toHaveBeenCalledOnce());
  expect(env.video.srcObject).toBeNull();
});
it("times out a video that never starts and releases its camera", async () => {
  vi.useFakeTimers();
  const env = setupRuntime();
  env.video.play = vi.fn(() => new Promise<void>(() => {}));
  const result = env.tracker.start().then(
    () => null,
    (e) => e,
  );
  await vi.advanceTimersByTimeAsync(10001);
  expect((await result).message).toContain("vídeo da câmera não iniciou");
  expect(env.oldStop).toHaveBeenCalledOnce();
  expect(env.video.srcObject).toBeNull();
});
it("discards async detections completing after camera shutdown", async () => {
  const env = setupRuntime();
  let done!: (result: any) => void;
  create.mockResolvedValue({
    detectForVideo: () =>
      new Promise((resolve) => {
        done = resolve;
      }),
    close,
  });
  await env.tracker.start();
  env.step(0);
  env.tracker.stop();
  done({ landmarks: [], handedness: [] });
  await Promise.resolve();
  expect(env.frame).not.toHaveBeenCalled();
  expect(env.error).not.toHaveBeenCalled();
});

it("cancels native fallback without starting another backend after shutdown", async () => {
  const env = setupRuntime();
  let complete!: (model: any) => void;
  create
    .mockRejectedValueOnce(new Error("GPU unavailable"))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
  const starting = env.tracker.start();
  await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(2));
  env.tracker.stop();
  expect(await starting).toBe(false);
  expect(cpu).not.toHaveBeenCalled();
  const lateClose = vi.fn();
  complete({ detectForVideo: detect, close: lateClose });
  await vi.waitFor(() => expect(lateClose).toHaveBeenCalledOnce());
});
