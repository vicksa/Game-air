import { test, expect } from "@playwright/test";
test("simulated landmarks drive calibration, actions, tracking loss, dwell and recalibration", async ({
  page,
  context,
}) => {
  test.setTimeout(45000);
  await context.grantPermissions(["camera"]);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator("#camera-start").click();
  await expect(page.locator("#modal-title")).toHaveText(
    "Encontre seu equilíbrio.",
    { timeout: 25000 },
  );
  await page.evaluate(async () => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { tracker } = await import(path);
    tracker.stop();
    const state = {
      pose: "open",
      left: 0.5,
      present: true,
      pointer: null as { x: number; y: number } | null,
    };
    (window as any).handsState = state;
    function points(pose: string, x: number) {
      const p = Array.from({ length: 21 }, () => ({ x, y: 0.7 }));
      p[9] = { x, y: 0.5 };
      for (const [n, t] of [8, 12, 16, 20].entries()) {
        const extended = pose === "open" || (pose === "victory" && n < 2);
        p[t - 2] = { x: x + n * 0.01, y: 0.48 };
        p[t] = { x: x + n * 0.01, y: extended ? 0.2 : 0.56 };
      }
      return p;
    }
    (window as any).handsInterval = setInterval(() => {
      const right = points(state.pose, 0.25);
      if (state.pointer) right[8] = state.pointer;
      const hands = state.present
        ? [
            { side: "Left", points: points("open", state.left), score: 0.99 },
            { side: "Right", points: right, score: 0.99 },
          ]
        : [];
      tracker.onFrame(hands, performance.now());
    }, 25);
  });
  await expect(page.locator("#modal-title")).toHaveText("Entre no dojo.");
  await page.getByRole("button", { name: "COMEÇAR MISSÃO" }).click();
  await page.waitForTimeout(300);
  await page.evaluate(() => ((window as any).handsState.pose = "victory"));
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const path = document.querySelector<HTMLScriptElement>(
          'script[src*="/src/main.ts"]',
        )!.src;
        const { scene } = await import(path);
        return scene.player.anims.currentAnim?.key;
      }),
    )
    .toBe("ninja-jump");
  await page.evaluate(() => ((window as any).handsState.left = 0.2));
  await page.waitForTimeout(450);
  await page.evaluate(() => ((window as any).handsState.left = 0.5));
  expect(
    await page.evaluate(async () => {
      const path = document.querySelector<HTMLScriptElement>(
        'script[src*="/src/main.ts"]',
      )!.src;
      const { scene } = await import(path);
      return scene.player.x;
    }),
  ).toBeGreaterThan(100);
  await page.waitForTimeout(700);
  await page.evaluate(async () => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { scene } = await import(path);
    (window as any).attacks = 0;
    scene.player.on("animationstart", (a: any) => {
      if (a.key === "ninja-attack") (window as any).attacks++;
    });
    (window as any).handsState.pose = "fist";
  });
  await expect.poll(() => page.evaluate(() => (window as any).attacks)).toBe(1);
  await page.waitForTimeout(650);
  expect(
    await page.evaluate(() => (window as any).attacks),
  ).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => ((window as any).handsState.pose = "open"));
  await expect(page.locator("#pose-status")).toContainText("DEFESA");
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const path = document.querySelector<HTMLScriptElement>(
          'script[src*="/src/main.ts"]',
        )!.src;
        const { scene } = await import(path);
        return scene.elapsed >= scene.attackReady && scene.command.defend;
      }),
    )
    .toBe(true);
  const attacksBefore = await page.evaluate(() => (window as any).attacks);
  await page.evaluate(() => ((window as any).handsState.pose = "fist"));
  await expect
    .poll(() => page.evaluate(() => (window as any).attacks))
    .toBeGreaterThan(attacksBefore);
  await page.evaluate(() => ((window as any).handsState.pose = "open"));
  await expect(page.locator("#pose-status")).toContainText("DEFESA");
  await page.evaluate(() => ((window as any).handsState.present = false));
  await expect(page.locator("#modal-title")).toHaveText("Cadê suas mãos?");
  await page.getByRole("button", { name: "CONTINUAR →", exact: true }).click();
  await expect(page.locator("#modal")).toBeVisible();
  await page.evaluate(() => ((window as any).handsState.present = true));
  await expect(page.locator("#tracking-status")).toHaveText(
    "Duas mãos conectadas",
  );
  await expect(page.locator("#modal")).toBeHidden({ timeout: 4000 });
  // A manual pause still waits for an intentional menu selection.
  await page.keyboard.press("Escape");
  const button = await page
    .getByRole("button", { name: "CONTINUAR →", exact: true })
    .boundingBox();
  const cabinet = await page.locator(".play-stage").boundingBox();
  await page.evaluate(
    ({ button, cabinet }) => {
      const x = (button!.x + button!.width / 2 - cabinet!.x) / cabinet!.width,
        y = (button!.y + button!.height / 2 - cabinet!.y) / cabinet!.height;
      (window as any).handsState.pointer = {
        x: 0.9 - 0.8 * x,
        y: 0.1 + 0.8 * y,
      };
    },
    { button, cabinet },
  );
  await expect(page.locator("#modal")).toBeHidden({ timeout: 4000 });
  await page.evaluate(() => ((window as any).handsState.pointer = null));
  await page.locator("#recalibrate").click();
  await expect(page.locator("#modal-title")).toHaveText(
    "Calibração concluída.",
    { timeout: 5000 },
  );
  await page.getByRole("button", { name: "CONTINUAR →", exact: true }).click();
  await page.evaluate(() => clearInterval((window as any).handsInterval));
  await page.locator("#camera-off").click();
  await expect(page.locator("#camera-placeholder")).toBeVisible();
  expect(errors).toEqual([]);
});
test("a model download failure closes the webcam and can be retried", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["camera"]);
  await page.route("**/models/**", (route) => route.abort());
  await page.goto("/");
  await page.locator("#camera-start").click();
  await expect(page.locator("#modal-title")).toHaveText(
    "A câmera precisa de atenção.",
    { timeout: 25000 },
  );
  expect(
    await page
      .locator("#webcam")
      .evaluate((v: HTMLVideoElement) => v.srcObject),
  ).toBeNull();
  await page.unroute("**/models/**");
  await page.getByRole("button", { name: "TENTAR NOVAMENTE →" }).click();
  await expect(page.locator("#modal-title")).toHaveText(
    "Encontre seu equilíbrio.",
    { timeout: 25000 },
  );
  await page.evaluate(() => {
    const video = document.querySelector<HTMLVideoElement>("#webcam")!;
    (window as any).oldTracks = (video.srcObject as MediaStream).getTracks();
  });
  await page.locator("#camera-off").click();
  expect(
    await page.evaluate(() =>
      (window as any).oldTracks.every(
        (t: MediaStreamTrack) => t.readyState === "ended",
      ),
    ),
  ).toBe(true);
});
