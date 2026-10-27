import { test, expect } from "@playwright/test";
for (const direction of [-1, 1]) {
  test(`hand jump stays available while walking in direction ${direction}`, async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["camera"]);
    await page.goto("/");
    await page.locator("#camera-start").click();
    await expect(page.locator("#modal-title")).toHaveText(
      "Encontre seu equilíbrio.",
      { timeout: 30000 },
    );
    await page.evaluate(async () => {
      const { tracker, scene } = await import(
        document.querySelector<HTMLScriptElement>(
          'script[src*="/src/main.ts"]',
        )!.src
      );
      const state = {
        tracker,
        scene,
        left: 0.5,
        pose: "none",
        takeoffs: [] as { vx: number; vy: number; x: number }[],
      };
      (window as any).movingJump = state;
      const points = (pose: string, x: number) => {
        const p = Array.from({ length: 21 }, () => ({ x, y: 0.7 }));
        p[9].y = 0.5;
        for (const [n, t] of [8, 12, 16, 20].entries()) {
          p[t - 2] = { x: x + n * 0.01, y: 0.48 };
          p[t] = {
            x: x + n * 0.01,
            y: pose === "open" || (pose === "victory" && n < 2) ? 0.2 : 0.56,
          };
        }
        return p;
      };
      tracker.model.detectForVideo = () => ({
        landmarks: [points("open", state.left), points(state.pose, 0.2)],
        handedness: [
          [{ categoryName: "Left", score: 0.99 }],
          [{ categoryName: "Right", score: 0.99 }],
        ],
      });
    });
    await expect(page.locator("#modal-title")).toHaveText("Entre no dojo.");
    await page
      .getByRole("button", { name: "COMEÇAR MISSÃO →", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).movingJump.scene.elapsed > 0),
      )
      .toBe(true);
    await page.evaluate(() => {
      const state = (window as any).movingJump;
      const scene = state.scene;
      scene.player.setPosition(400, 320).setVelocity(0, 0);
      scene.hurtUntil = Infinity; // Isolate locomotion from enemy/spike damage.
      let previous = 0;
      scene.events.on("postupdate", () => {
        const { x: vx, y: vy } = scene.player.body.velocity;
        if (previous >= 0 && vy < -200)
          state.takeoffs.push({ vx, vy, x: scene.player.x });
        previous = vy;
      });
    });
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as any).movingJump.scene.player.body.blocked.down,
        ),
      )
      .toBe(true);
    await page.evaluate((direction) => {
      (window as any).movingJump.left = 0.5 - direction * 0.1;
    }, direction);
    await expect
      .poll(() =>
        page.evaluate(
          (direction) =>
            (window as any).movingJump.scene.player.body.velocity.x * direction,
          direction,
        ),
      )
      .toBeGreaterThan(0);
    await page.evaluate(() => {
      (window as any).movingJump.pose = "victory";
    });
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).movingJump.takeoffs.length),
      )
      .toBeGreaterThanOrEqual(1);
    expect(
      await page.evaluate(
        (direction) =>
          (window as any).movingJump.takeoffs[0].vx * direction > 0,
        direction,
      ),
    ).toBe(true);
    // Keeping V raised must not consume jump forever after the first takeoff.
    await expect
      .poll(
        () => page.evaluate(() => (window as any).movingJump.takeoffs.length),
        { timeout: 3500 },
      )
      .toBeGreaterThanOrEqual(2);
    await page.evaluate(() => {
      const s = (window as any).movingJump;
      s.pose = "none";
      s.left = 0.5;
    });
    const count = await page.evaluate(
      () => (window as any).movingJump.takeoffs.length,
    );
    await page.waitForTimeout(1200);
    expect(
      await page.evaluate(() => (window as any).movingJump.takeoffs.length),
    ).toBe(count);
  });
}
