import { test, expect, type Page } from "@playwright/test";
import type { Hand } from "../../src/controls";
function hand(side: "Left" | "Right", x: number, score = 0.99): Hand {
  const points = Array.from({ length: 21 }, () => ({ x, y: 0.7 }));
  points[9] = { x, y: 0.5 };
  for (const [n, t] of [8, 12, 16, 20].entries()) {
    points[t - 2] = { x: x + n * 0.01, y: 0.48 };
    points[t] = { x: x + n * 0.01, y: 0.2 };
  }
  return { side, points, score };
}
const pair = [hand("Left", 0.65), hand("Right", 0.25)];
async function inject(page: Page, samples: Hand[]) {
  await page.evaluate(async (samples) => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { tracker } = await import(path);
    tracker.stop();
    (window as any).testHands = samples;
    (window as any).testHandTimer = setInterval(
      () => tracker.onFrame((window as any).testHands, performance.now()),
      25,
    );
  }, samples);
}
test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(["camera"]);
  await page.goto("/");
  await page.locator("#camera-start").click();
  await expect(page.locator("#modal-title")).toHaveText(
    "Encontre seu equilíbrio.",
    { timeout: 25000 },
  );
});
test("starting after one hand leaves for the mouse waits safely then continues automatically", async ({
  page,
}) => {
  await inject(page, pair);
  await expect(page.locator("#modal-title")).toHaveText("Entre no dojo.");
  await page.evaluate(() => {
    (window as any).testHands = (window as any).testHands.slice(1);
  });
  await expect(page.locator("#tracking-status")).toHaveText(
    "Mãos detectadas: 1/2",
  );
  await page
    .getByRole("button", { name: "COMEÇAR MISSÃO →", exact: true })
    .click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#title-screen")).toBeHidden();
  await expect(page.locator("#modal-title")).toHaveText("Missão pronta.");
  const state = () =>
    page.evaluate(async () => {
      const path = document.querySelector<HTMLScriptElement>(
        'script[src*="/src/main.ts"]',
      )!.src;
      const { scene } = await import(path);
      return {
        active: scene.scene.isActive(),
        x: scene.player.x,
        y: scene.player.y,
      };
    });
  await expect.poll(async () => (await state()).active).toBe(false);
  const frozen = await state();
  await page.waitForTimeout(300);
  expect(await state()).toEqual(frozen);
  await page.evaluate((pair) => ((window as any).testHands = pair), pair);
  await expect(page.locator("#modal")).toBeHidden({ timeout: 4000 });
  await expect.poll(async () => (await state()).active).toBe(true);
});
test("ambiguous side labels do not block two-hand calibration", async ({
  page,
}) => {
  await inject(page, [hand("Left", 0.65, 0.55), hand("Left", 0.25, 0.55)]);
  await expect(page.locator("#tracking-status")).toHaveText(
    "Duas mãos conectadas",
  );
  await expect(page.locator("#modal-title")).toHaveText("Entre no dojo.");
  await page
    .getByRole("button", { name: "COMEÇAR MISSÃO →", exact: true })
    .click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#modal")).toBeHidden();
});
test("a camera with no hands still offers a working way into the mission", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "COMEÇAR MISSÃO →", exact: true })
    .click();
  await expect(page.locator("#modal-title")).toHaveText("Missão pronta.");
  await expect(page.locator("#waiting-hands-status")).toHaveText(
    "Mãos detectadas: 0/2",
  );
  await page.screenshot({
    path: "test-results/waiting-for-hands.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "JOGAR COM TECLADO →", exact: true })
    .click();
  await expect(page.locator("#modal")).toBeHidden();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#session-status")).toContainText("TECLADO");
  expect(
    await page
      .locator("#webcam")
      .evaluate((video: HTMLVideoElement) => video.srcObject),
  ).toBeNull();
});
