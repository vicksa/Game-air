import { describe, expect, it } from "vitest";
import {
  classify,
  GestureController,
  neutral,
  resolveHands,
  type Point,
  type Hand,
  type Pose,
} from "../src/controls";
function points(pose: Pose, x = 0.5): Point[] {
  const p = Array.from({ length: 21 }, () => ({ x, y: 0.7 }));
  p[9] = { x, y: 0.5 };
  for (const [n, t] of [8, 12, 16, 20].entries()) {
    const open = pose === "open" || (pose === "victory" && n < 2);
    p[t - 2] = { x: x + n * 0.01, y: 0.48 };
    p[t] = { x: x + n * 0.01, y: open ? 0.2 : 0.56 };
  }
  return p;
}
const hands = (pose: Pose, x = 0.5): Hand[] => [
  { side: "Left", points: points("open", x), score: 0.99 },
  { side: "Right", points: points(pose), score: 0.99 },
];
describe("gestures", () => {
  it("classifies open palm, fist and V regardless of image rotation", () => {
    for (const pose of ["open", "fist", "victory"] as Pose[]) {
      const p = points(pose);
      expect(classify(p)).toBe(pose);
      expect(classify(p.map((v) => ({ x: v.y, y: 1 - v.x })))).toBe(pose);
    }
  });
  it("rejects incomplete landmarks", () => expect(classify([])).toBe("none"));
  it("requires stable pose and emits a single action until release", () => {
    const c = new GestureController();
    expect(c.update(hands("fist"), 0).attack).toBe(false);
    expect(c.update(hands("fist"), 120).attack).toBe(true);
    expect(c.update(hands("fist"), 240).attack).toBe(false);
    c.update(hands("open"), 300);
    expect(c.update(hands("open"), 420).defend).toBe(true);
    c.update(hands("fist"), 450);
    expect(c.update(hands("fist"), 570).attack).toBe(true);
  });
  it("filters brief gestures and small position jitter", () => {
    const c = new GestureController();
    c.update(hands("fist", 0.48), 0);
    c.update(hands("victory", 0.52), 50);
    expect(c.update(hands("open", 0.49), 100)).toEqual(neutral());
  });
  it("supports movement and jump together", () => {
    const c = new GestureController();
    c.update(hands("victory", 0.1), 0);
    const r = c.update(hands("victory", 0.1), 120);
    expect(r.move).toBe(1);
    expect(r.jump).toBe(true);
  });
  it("clears defense and motion after loss of either hand or invalid landmarks", () => {
    const c = new GestureController();
    c.update(hands("open"), 0);
    c.update(hands("open"), 150);
    expect(c.update(hands("open").slice(0, 1), 200)).toEqual(neutral());
    const low = hands("open");
    low[0].points = [];
    expect(c.update(low, 250)).toEqual(neutral());
  });
  it("honors calibrated neutral position", () => {
    const c = new GestureController();
    c.center = 0.7;
    c.reset();
    expect(c.update(hands("open", 0.3), 200).move).toBe(0);
  });
});

describe("hand presence", () => {
  it("keeps two detected hands when handedness confidence is moderate", () => {
    const pair = hands("open");
    pair.forEach((h) => (h.score = 0.2));
    expect(resolveHands(pair)).toHaveLength(2);
    const c = new GestureController();
    c.update(pair, 0);
    expect(c.update(pair, 150).defend).toBe(true);
  });
  it("assigns distinct controls when both hands receive the same side label", () => {
    const pair: Hand[] = [
      { side: "Left", points: points("open", 0.7), score: 0.9 },
      { side: "Left", points: points("victory", 0.3), score: 0.9 },
    ];
    const resolved = resolveHands(pair);
    expect(resolved.map((h) => h.side)).toEqual(["Left", "Right"]);
    expect(resolved[0].points[9].x).toBe(0.7);
    const c = new GestureController();
    c.update(pair, 0);
    expect(c.update(pair, 150).jump).toBe(true);
  });
  it("rejects incomplete and non-finite landmarks without crashing controls", () => {
    const pair = hands("open");
    pair[0].points = [];
    expect(new GestureController().update(pair, 100)).toEqual(neutral());
    pair[0].points = points("open");
    pair[0].points[9].x = NaN;
    expect(resolveHands(pair)).toHaveLength(1);
  });
});

describe("short-range movement", () => {
  it("walks at full command with a small offset and keeps walking without further displacement", () => {
    const c = new GestureController();
    c.update(hands("none", 0.46), 0);
    expect(c.update(hands("none", 0.46), 120).move).toBe(1);
    expect(c.update(hands("none", 0.46), 1000).move).toBe(1);
    c.update(hands("none", 0.5), 1050);
    expect(c.update(hands("none", 0.5), 1200).move).toBe(0);
  });
  it("has similar response at slow and fast inference rates and exposes adjustable sensitivity", () => {
    for (const step of [25, 100]) {
      const c = new GestureController();
      for (let t = 0; t <= 200; t += step) c.update(hands("none", 0.46), t);
      expect(c.update(hands("none", 0.46), 300).move).toBe(1);
    }
    const c = new GestureController();
    c.sensitivity = 3;
    c.update(hands("none", 0.475), 0);
    expect(c.update(hands("none", 0.475), 200).move).toBe(1);
  });
});

describe("stopping without a latched direction", () => {
  for (const side of [-1, 1]) {
    it(`stops from direction ${side} anywhere inside the neutral zone`, () => {
      const c = new GestureController();
      c.update(hands("open", 0.5 - side * 0.1), 0);
      expect(c.update(hands("open", 0.5 - side * 0.1), 120).move).toBe(side);
      // Previously this offset was outside the small release zone, retaining
      // the previous direction indefinitely, even on the opposite side.
      expect(c.update(hands("open", 0.48), 150).move).toBe(0);
      expect(c.update(hands("open", 0.52), 180).move).toBe(0);
      expect(c.update(hands("open", 0.48), 250).move).toBe(0);
    });
  }
  it("the left fist stops without shifting neutral or blocking the opposite direction", () => {
    const c = new GestureController();
    c.update(hands("open", 0.4), 0);
    expect(c.update(hands("open", 0.4), 120).move).toBe(1);
    const pair = hands("open", 0.39);
    pair[0].points = points("fist", 0.39);
    expect(c.update(pair, 150).move).toBe(0);
    expect(c.center).toBe(0.5);
    expect(c.update(hands("open", 0.5), 200).move).toBe(0);
    c.update(hands("open", 0.6), 250);
    expect(c.update(hands("open", 0.6), 400).move).toBe(-1);
  });
});

it("repeats fist attacks at a bounded cadence and stops repeating on release", () => {
  const c = new GestureController();
  c.update(hands("fist"), 0);
  expect(c.update(hands("fist"), 120).attack).toBe(true);
  expect(c.update(hands("fist"), 600).attack).toBe(false);
  expect(c.update(hands("fist"), 720).attack).toBe(true);
  expect(c.update(hands("fist"), 800).attack).toBe(false);
  expect(c.update(hands("open"), 1400).attack).toBe(false);
});

for (const direction of [-1, 1] as const) {
  it(`keeps held V available while walking ${direction} and clears it immediately on release`, () => {
    const controller = new GestureController();
    const movingHands = hands("victory", 0.5 - direction * 0.1);
    expect(controller.update(movingHands, 0).jump).toBe(false);
    for (const time of [120, 250, 600, 1100]) {
      expect(controller.update(movingHands, time)).toMatchObject({
        move: direction,
        jump: true,
        defend: false,
      });
    }
    expect(
      controller.update(hands("open", 0.5 - direction * 0.1), 1150),
    ).toMatchObject({ move: direction, jump: false });
    expect(controller.update(movingHands.slice(0, 1), 1200)).toEqual(neutral());
  });
}
