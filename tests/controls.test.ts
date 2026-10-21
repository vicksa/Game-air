import { describe, expect, it } from "vitest";
import {
  classify,
  GestureController,
  neutral,
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
  it("clears defense and motion after loss of either hand or low confidence", () => {
    const c = new GestureController();
    c.update(hands("open"), 0);
    c.update(hands("open"), 150);
    expect(c.update(hands("open").slice(0, 1), 200)).toEqual(neutral());
    const low = hands("open");
    low[0].score = 0.2;
    expect(c.update(low, 250)).toEqual(neutral());
  });
  it("honors calibrated neutral position", () => {
    const c = new GestureController();
    c.center = 0.7;
    c.reset();
    expect(c.update(hands("open", 0.3), 200).move).toBe(0);
  });
});
