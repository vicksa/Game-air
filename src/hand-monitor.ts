import type { Hand } from "./controls";
const fingers = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [5, 9, 10, 11, 12],
  [9, 13, 14, 15, 16],
  [13, 17, 18, 19, 20],
  [0, 17],
];
/** The camera is mirrored by CSS; landmarks are mirrored here exactly once. */
export function drawHandPreview(canvas: HTMLCanvasElement, hands: Hand[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  // A quiet grid gives spatial feedback even when video is dark.
  ctx.strokeStyle = "rgba(157,180,203,.1)";
  ctx.lineWidth = 1;
  for (let x = width / 4; x < width; x += width / 4) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = height / 3; y < height; y += height / 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (const hand of hands) {
    const color = hand.side === "Left" ? "#ffc477" : "#8ce3ce";
    const point = (i: number) => ({
      x: (1 - hand.points[i].x) * width,
      y: hand.points[i].y * height,
    });
    ctx.beginPath();
    [0, 5, 9, 13, 17].forEach((i, n) => {
      const p = point(i);
      if (n) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fillStyle =
      hand.side === "Left" ? "rgba(255,196,119,.18)" : "rgba(140,227,206,.18)";
    ctx.fill();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const edge of fingers) {
      ctx.beginPath();
      edge.forEach((i, n) => {
        const p = point(i);
        if (n) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      });
      ctx.strokeStyle = "#0b1225";
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    for (let i = 0; i < hand.points.length; i++) {
      const p = point(i);
      ctx.fillStyle = "#10152d";
      ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
      ctx.fillStyle = color;
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
    const wrist = point(0);
    const x = Math.max(6, Math.min(width - 110, wrist.x - 45)),
      y = Math.max(22, Math.min(height - 20, wrist.y + 25));
    ctx.fillStyle = "#10152d";
    ctx.fillRect(x - 4, y - 18, 112, 24);
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = color;
    ctx.fillText(hand.side === "Left" ? "ESQUERDA" : "DIREITA", x, y);
  }
}
