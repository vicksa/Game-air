import { resolveHands, type Hand } from "./controls";

// Preserve identity through short label changes, without inventing detections.
// Missing hands are never emitted and cannot keep movement/attacks active.
export class HandIdentity {
  private previous: { hand: Hand; time: number }[] = [];
  reset() {
    this.previous = [];
  }
  update(input: Hand[], now: number): Hand[] {
    const hands = resolveHands(input);
    const recent = this.previous.filter((p) => now - p.time <= 350);
    const distance = (a: Hand, b: Hand) =>
      Math.hypot(a.points[9].x - b.points[9].x, a.points[9].y - b.points[9].y);
    const candidates = hands
      .flatMap((hand, i) =>
        recent.map((p, j) => ({ i, j, distance: distance(hand, p.hand) })),
      )
      .sort((a, b) => a.distance - b.distance);
    const matched = new Map<number, Hand["side"]>();
    const used = new Set<number>();
    for (const candidate of candidates) {
      if (candidate.distance > 0.22) break;
      if (matched.has(candidate.i) || used.has(candidate.j)) continue;
      matched.set(candidate.i, recent[candidate.j].hand.side);
      used.add(candidate.j);
    }
    let result = hands.map((hand, i) => ({
      ...hand,
      side: matched.get(i) ?? hand.side,
    }));
    if (result.length === 2 && result[0].side === result[1].side) {
      // A newly appearing hand takes the remaining side of a tracked pair.
      const fixed = matched.has(0) ? 0 : matched.has(1) ? 1 : -1;
      if (fixed >= 0) {
        const other = 1 - fixed;
        result[other] = {
          ...result[other],
          side: result[fixed].side === "Left" ? "Right" : "Left",
        };
      } else result = resolveHands(result);
    }
    this.previous = [
      ...result.map((hand) => ({ hand, time: now })),
      ...recent.filter((p) => !result.some((h) => h.side === p.hand.side)),
    ];
    return result;
  }
}
