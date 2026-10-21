import { test, expect } from "@playwright/test";
function hand(side: "Left" | "Right", x: number) {
  const points = Array.from({ length: 21 }, () => ({ x, y: 0.7 }));
  points[9] = { x, y: 0.5 };
  for (const [n, t] of [8, 12, 16, 20].entries()) {
    points[t - 2] = { x: x + n * 0.01, y: 0.48 };
    points[t] = { x: x + n * 0.01, y: 0.2 };
  }
  return { side, points, score: 0.99 };
}
test("the hand view has dedicated space and remains visible beside calibration and play", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["camera"]);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#hand-monitor")).toBeVisible();
  await expect(page.locator("#hand-count")).toHaveText("0/2");
  const stage = await page.locator(".play-stage").boundingBox(),
    panel = await page.locator("#hand-monitor").boundingBox();
  expect(panel!.x).toBeGreaterThanOrEqual(stage!.x + stage!.width - 1);
  expect(panel!.width).toBeGreaterThan(200);
  const swap = await page.locator("#swap-hands").boundingBox();
  expect(swap!.y + swap!.height).toBeLessThanOrEqual(panel!.y + panel!.height);
  await page.locator("#monitor-camera-start").click();
  await expect(page.locator("#modal-title")).toHaveText(
    "Encontre seu equilíbrio.",
    { timeout: 25000 },
  );
  await page.evaluate(
    async (pair) => {
      const path = document.querySelector<HTMLScriptElement>(
        'script[src*="/src/main.ts"]',
      )!.src;
      const { tracker } = await import(path);
      tracker.stop();
      tracker.onFrame(pair, performance.now());
    },
    [hand("Left", 0.7), hand("Right", 0.3)],
  );
  await expect(page.locator("#hand-count")).toHaveText("2/2");
  await expect(page.locator("#left-hand-state")).toHaveAttribute(
    "data-detected",
    "true",
  );
  await expect(page.locator("#right-hand-action")).toHaveText(
    "PALMA · DEFENDER",
  );
  const colors = () =>
    page.locator("#landmarks").evaluate((canvas: HTMLCanvasElement) => {
      const pixels = canvas
        .getContext("2d")!
        .getImageData(0, 0, canvas.width, canvas.height).data;
      let amber = 0,
        green = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] < 200) continue;
        if (
          pixels[i] > 220 &&
          pixels[i + 1] > 130 &&
          pixels[i + 1] < 220 &&
          pixels[i + 2] < 160
        )
          amber++;
        if (pixels[i] < 180 && pixels[i + 1] > 190 && pixels[i + 2] > 160)
          green++;
      }
      return { amber, green };
    });
  expect((await colors()).amber).toBeGreaterThan(100);
  expect((await colors()).green).toBeGreaterThan(100);
  await page.screenshot({
    path: "test-results/hand-monitor-desktop.png",
    fullPage: true,
  });
  await page.evaluate(
    async (single) => {
      const path = document.querySelector<HTMLScriptElement>(
        'script[src*="/src/main.ts"]',
      )!.src;
      const { tracker } = await import(path);
      tracker.onFrame(single, performance.now());
    },
    [hand("Left", 0.7)],
  );
  await expect(page.locator("#hand-count")).toHaveText("1/2");
  await expect(page.locator("#right-hand-action")).toHaveText("NÃO DETECTADA");
  expect((await colors()).green).toBe(0);
  await page.locator("#camera-off").click();
  await expect(page.locator("#hand-count")).toHaveText("0/2");
  await expect(page.locator("#camera-placeholder")).toBeVisible();
  expect((await colors()).amber).toBe(0);
  await page.getByRole("button", { name: "USAR TECLADO", exact: true }).click();
  await page
    .getByRole("button", { name: "COMEÇAR MISSÃO →", exact: true })
    .click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#hand-monitor")).toBeVisible();
  expect(errors).toEqual([]);
});
test("the hand view stays inside the game frame on narrow screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const stage = await page.locator(".play-stage").boundingBox(),
    panel = await page.locator("#hand-monitor").boundingBox(),
    cabinet = await page.locator(".cabinet").boundingBox();
  expect(panel!.y).toBeGreaterThanOrEqual(stage!.y + stage!.height - 1);
  expect(panel!.x).toBeGreaterThanOrEqual(cabinet!.x);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(
    cabinet!.x + cabinet!.width,
  );
  await expect(page.locator("#camera-start")).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    path: "test-results/hand-monitor-mobile.png",
    fullPage: true,
  });
});

test("side override swaps both preview labels and controls without discarding uncertain handedness", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["camera"]);
  await page.goto("/");
  await page.locator("#monitor-camera-start").click();
  await expect(page.locator("#modal-title")).toHaveText(
    "Encontre seu equilíbrio.",
    { timeout: 25000 },
  );
  const pair = [hand("Left", 0.7), hand("Right", 0.3)];
  pair.forEach((h) => (h.score = 0.2));
  const inject = () =>
    page.evaluate(async (hands) => {
      const { tracker } = await import(
        document.querySelector<HTMLScriptElement>(
          'script[src*="/src/main.ts"]',
        )!.src
      );
      tracker.stop();
      tracker.onFrame(hands, performance.now());
    }, pair);
  await inject();
  await expect(page.locator("#hand-count")).toHaveText("2/2");
  const amberX = () =>
    page.locator("#landmarks").evaluate((canvas: HTMLCanvasElement) => {
      const { data } = canvas
        .getContext("2d")!
        .getImageData(0, 0, canvas.width, canvas.height);
      let sum = 0,
        count = 0;
      for (let i = 0; i < data.length; i += 4)
        if (
          data[i] > 220 &&
          data[i + 1] > 130 &&
          data[i + 1] < 220 &&
          data[i + 2] < 160 &&
          data[i + 3] > 200
        ) {
          sum += (i / 4) % canvas.width;
          count++;
        }
      return sum / count;
    });
  expect(await amberX()).toBeLessThan(240);
  await page.locator("#swap-hands").click();
  await expect(page.locator("#swap-hands")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await inject();
  await expect(page.locator("#hand-count")).toHaveText("2/2");
  expect(await amberX()).toBeGreaterThan(240);
  await page.locator("#swap-hands").click();
  await inject();
  expect(await amberX()).toBeLessThan(240);
});

test("brief landmark loss clears the preview without restarting calibration", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["camera"]);
  await page.goto("/");
  await page.locator("#monitor-camera-start").click();
  await expect(page.locator("#modal-title")).toHaveText(
    "Encontre seu equilíbrio.",
    { timeout: 25000 },
  );
  await page.evaluate(
    async (pair) => {
      const { tracker } = await import(
        document.querySelector<HTMLScriptElement>(
          'script[src*="/src/main.ts"]',
        )!.src
      );
      tracker.stop();
      const now = performance.now();
      tracker.onFrame(pair, now);
      tracker.onFrame(pair, now + 1000);
      tracker.onFrame([], now + 1100);
      (window as any).trackingTest = { tracker, pair, now };
    },
    [hand("Left", 0.7), hand("Right", 0.3)],
  );
  await expect(page.locator("#hand-count")).toHaveText("0/2");
  expect(
    await page
      .locator("#calibration-fill")
      .evaluate((el) => parseFloat((el as HTMLElement).style.width)),
  ).toBeGreaterThan(50);
  await page.evaluate(() => {
    const { tracker, pair, now } = (window as any).trackingTest;
    tracker.onFrame(pair, now + 1200);
    tracker.onFrame(pair, now + 1850);
  });
  await expect(page.locator("#modal-title")).toHaveText("Entre no dojo.");
});
