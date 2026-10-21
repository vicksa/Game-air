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
export class GestureController {
  center = 0.5;
  smoothX = 0.5;
  pose: Pose = "none";
  private candidate: Pose = "none";
  private candidateSince = 0;
  private stable: Pose = "none";
  reset() {
    this.pose = this.candidate = this.stable = "none";
    this.candidateSince = 0;
    this.smoothX = this.center;
  }
  update(hands: Hand[], now: number): Command {
    const left = hands.find((h) => h.side === "Left" && h.score >= 0.6);
    const right = hands.find((h) => h.side === "Right" && h.score >= 0.6);
    if (!left || !right) {
      this.reset();
      return neutral();
    }
    this.smoothX += (1 - left.points[9].x - this.smoothX) * 0.28;
    const delta = this.smoothX - this.center;
    const result = neutral();
    result.move = delta < -0.095 ? -1 : delta > 0.095 ? 1 : 0;
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
