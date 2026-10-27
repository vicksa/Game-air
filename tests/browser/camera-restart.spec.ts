import { test, expect, type Page } from "@playwright/test";
import type { Hand } from "../../src/controls";
const makeHand = (side: Hand["side"], x: number): Hand => {
  const points = Array.from({ length: 21 }, () => ({ x, y: 0.6 }));
  for (const tip of [8, 12, 16, 20]) {
    points[tip - 2].y = 0.45;
    points[tip].y = 0.2;
  }
  // Keep the menu pointer away from buttons until explicitly positioned.
  points[8] = { x: 0.85, y: 0.2 };
  return { side, score: 0.99, points };
};
const pair = [makeHand("Left", 0.65), makeHand("Right", 0.25)];
async function start(page: Page) {
  await page.goto("/");
  await page.locator("#camera-start").click();
  await expect(page.locator("#modal-title")).toHaveText(
    "Encontre seu equilíbrio.",
    { timeout: 30000 },
  );
  await page.evaluate(async (hands) => {
    const { tracker, scene } = await import(
      document.querySelector<HTMLScriptElement>('script[src*="/src/main.ts"]')!
        .src
    );
    (window as any).restartProbe = {
      tracker,
      scene,
      hands,
      stream: document.querySelector<HTMLVideoElement>("#webcam")!.srcObject,
    };
    tracker.model.detectForVideo = () => {
      const hands: Hand[] = (window as any).restartProbe.hands;
      return {
        landmarks: hands.map((h) => h.points),
        handedness: hands.map((h) => [
          { categoryName: h.side, score: h.score },
        ]),
      };
    };
  }, pair);
  await expect(page.locator("#modal-title")).toHaveText("Entre no dojo.");
  await page
    .getByRole("button", { name: "COMEÇAR MISSÃO →", exact: true })
    .click();
}
async function die(page: Page) {
  // Restart is queued until Phaser's next frame; do not modify the old player.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const scene = (window as any).restartProbe.scene;
        return scene.elapsed > 0 && scene.hp === 5 && !scene.finished;
      }),
    )
    .toBe(true);
  await page.evaluate(() => {
    const scene = (window as any).restartProbe.scene;
    scene.hp = 1;
    scene.player.setPosition(700, 420);
  });
  await expect(page.locator("#modal-title")).toHaveText("O caminho continua.");
}
async function cameraIntact(page: Page) {
  expect(
    await page.evaluate(() => {
      const p = (window as any).restartProbe;
      return (
        p.tracker.cameraActive &&
        document.querySelector<HTMLVideoElement>("#webcam")!.srcObject ===
          p.stream &&
        p.stream
          .getTracks()
          .every((t: MediaStreamTrack) => t.readyState === "live")
      );
    }),
  ).toBe(true);
}
test("webcam and hand control survive two deaths and restarts", async ({
  page,
}) => {
  await start(page);
  for (let attempt = 0; attempt < 2; attempt++) {
    await die(page);
    await page
      .getByRole("button", { name: "JOGAR NOVAMENTE →", exact: true })
      .click();
    await expect(page.locator("#modal")).toBeHidden();
    await expect(page.locator("#session-status")).toContainText("GESTOS");
    await cameraIntact(page);
    await page.evaluate(() => {
      (window as any).restartProbe.hands[0].points.forEach(
        (p: { x: number }) => (p.x = 0.5),
      );
    });
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as any).restartProbe.scene.player.body.velocity.x,
        ),
      )
      .toBeGreaterThan(0);
    await page.evaluate((hands) => {
      (window as any).restartProbe.hands = hands;
    }, pair);
  }
});
test("a hand over the keyboard alternative cannot silently disconnect the camera after retry", async ({
  page,
}) => {
  await start(page);
  await die(page);
  await page.evaluate(() => {
    (window as any).restartProbe.hands = (
      window as any
    ).restartProbe.hands.slice(1);
  });
  await expect(page.locator("#hand-count")).toHaveText("1/2");
  await page
    .getByRole("button", { name: "JOGAR NOVAMENTE →", exact: true })
    .click();
  await expect(page.locator("#modal-title")).toHaveText("Missão pronta.");
  await page.evaluate(() => {
    const box = document.querySelector(".play-stage")!.getBoundingClientRect();
    const button = Array.from(
      document.querySelectorAll("#modal-actions button"),
    )
      .find((b) => b.textContent!.includes("TECLADO"))!
      .getBoundingClientRect();
    (window as any).restartProbe.hands[0].points[8] = {
      x: 1 - (0.1 + ((button.x + button.width / 2 - box.x) / box.width) * 0.8),
      y: 0.1 + ((button.y + button.height / 2 - box.y) / box.height) * 0.8,
    };
  });
  await page.waitForTimeout(1800);
  await cameraIntact(page);
  await page.evaluate((hands) => {
    (window as any).restartProbe.hands = hands;
  }, pair);
  await expect(page.locator("#modal")).toBeHidden();
  await expect(page.locator("#session-status")).toContainText("GESTOS");
  // Explicit click still allows switching modes and releases the webcam.
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "JOGAR COM TECLADO", exact: true })
    .click();
  await expect(page.locator("#modal")).toBeHidden();
  await expect(page.locator("#session-status")).toContainText("TECLADO");
  expect(
    await page.evaluate(() => {
      const probe = (window as any).restartProbe;
      return (
        !probe.tracker.cameraActive &&
        probe.stream
          .getTracks()
          .every((t: MediaStreamTrack) => t.readyState === "ended")
      );
    }),
  ).toBe(true);
});
