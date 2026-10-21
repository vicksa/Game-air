export type Point = { x: number; y: number; z?: number };
export type Pose = "none" | "open" | "fist" | "victory";
export interface Hand {
  side: "Left" | "Right";
  points: Point[];
  score: number;
}
export interface Command {
  move: -1 | 0 | 1;
  jump: boolean;
  attack: boolean;
  defend: boolean;
}
export const neutral = (): Command => ({
  move: 0,
  jump: false,
  attack: false,
  defend: false,
});
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function classify(p: Point[]): Pose {
  if (p.length !== 21) return "none";
  // Distances from the wrist work on rotated hands; scale comes from palm length.
  const extended = [8, 12, 16, 20].map(
    (t) => distance(p[t], p[0]) > distance(p[t - 2], p[0]) * 1.18,
  );
  if (extended.every(Boolean)) return "open";
  if (extended.every((v) => !v)) return "fist";
  if (extended[0] && extended[1] && !extended[2] && !extended[3])
    return "victory";
  return "none";
}
// The score describes left/right classification, not whether landmarks exist.
// Some poses label both detected hands alike; use mirrored screen position then.
export function resolveHands(hands: Hand[]): Hand[] {
  const valid = hands
    .filter(
      (h) =>
        Number.isFinite(h.score) &&
        h.points.length === 21 &&
        h.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    )
    .slice(0, 2);
  if (valid.length !== 2 || valid[0].side !== valid[1].side) return valid;
  const [left, right] = [...valid].sort(
    (a, b) => b.points[9].x - a.points[9].x,
  );
  return [
    { ...left, side: "Left" },
    { ...right, side: "Right" },
  ];
}
export class GestureController {
  center = 0.5;
  sensitivity = 2;
  private lastUpdate = -1;
  get movementThreshold() {
    return 0.06 / this.sensitivity;
  }
  smoothX = 0.5;
  pose: Pose = "none";
  private candidate: Pose = "none";
  private candidateSince = 0;
  private stable: Pose = "none";
  reset() {
    this.pose = this.candidate = this.stable = "none";
    this.candidateSince = 0;
    this.smoothX = this.center;
    this.lastUpdate = -1;
  }
  update(hands: Hand[], now: number): Command {
    const resolved = resolveHands(hands);
    const left = resolved.find((h) => h.side === "Left");
    const right = resolved.find((h) => h.side === "Right");
    if (!left || !right) {
      this.reset();
      return neutral();
    }
    const dt =
      this.lastUpdate < 0
        ? 33
        : Math.min(100, Math.max(0, now - this.lastUpdate));
    this.lastUpdate = now;
    const handX = 1 - left.points[9].x;
    const threshold = this.movementThreshold;
    const stop = Math.abs(handX - this.center) <= threshold;
    // Entering the neutral zone stops immediately, without a retained direction
    // or smoothing from a previous movement carrying the character forward.
    this.smoothX = stop
      ? handX
      : this.smoothX + (handX - this.smoothX) * (1 - Math.exp(-dt / 45));
    const delta = this.smoothX - this.center;
    const result = neutral();
    const stopGesture = classify(left.points) === "fist";
    if (stopGesture) {
      this.center = handX;
      this.smoothX = handX;
    }
    result.move =
      stop || stopGesture
        ? 0
        : delta < -threshold
          ? -1
          : delta > threshold
            ? 1
            : 0;
    this.pose = classify(right.points);
    if (this.pose !== this.candidate) {
      this.candidate = this.pose;
      this.candidateSince = now;
    }
    if (now - this.candidateSince >= 110 && this.stable !== this.candidate) {
      this.stable = this.candidate;
      result.jump = this.stable === "victory";
      result.attack = this.stable === "fist";
    }
    result.defend = this.stable === "open";
    return result;
  }
}
