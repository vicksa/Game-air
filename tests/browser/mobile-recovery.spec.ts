import { test, expect } from "@playwright/test";

test("portrait touch controls move, jump and release independently", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("#keyboard-start").click();
  await page
    .getByRole("button", { name: "COMEÇAR MISSÃO →", exact: true })
    .click();
  const touch = page.locator("#touch-controls");
  await expect(touch).toBeVisible();
  await expect(touch.locator('[data-touch="defend"]')).toBeInViewport({
    ratio: 1,
  });
  const read = () =>
    page.evaluate(async () => {
      const { scene } = await import(
        document.querySelector<HTMLScriptElement>(
          'script[src*="/src/main.ts"]',
        )!.src
      );
      return {
        x: scene.player.x,
        y: scene.player.y,
        vy: scene.player.body.velocity.y,
        defend: scene.defending,
        move: scene.command.move,
      };
    });
  await expect.poll(async () => (await read()).vy).toBe(0);
  const start = (await read()).x;
  await touch
    .locator('[data-touch="right"]')
    .dispatchEvent("pointerdown", { pointerId: 1 });
  await expect.poll(async () => (await read()).x).toBeGreaterThan(start + 15);
  await touch
    .locator('[data-touch="jump"]')
    .dispatchEvent("pointerdown", { pointerId: 2 });
  await expect.poll(async () => (await read()).vy).toBeLessThan(-100);
  await touch
    .locator('[data-touch="jump"]')
    .dispatchEvent("pointerup", { pointerId: 2 });
  expect((await read()).move).toBe(1);
  await touch
    .locator('[data-touch="right"]')
    .dispatchEvent("pointercancel", { pointerId: 1 });
  await expect.poll(async () => (await read()).move).toBe(0);
  await touch
    .locator('[data-touch="defend"]')
    .dispatchEvent("pointerdown", { pointerId: 3 });
  await expect.poll(async () => (await read()).defend).toBe(true);
  await touch
    .locator('[data-touch="defend"]')
    .dispatchEvent("pointerup", { pointerId: 3 });
  await expect.poll(async () => (await read()).defend).toBe(false);
  await touch
    .locator('[data-touch="attack"]')
    .dispatchEvent("pointerdown", { pointerId: 4 });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { scene } = await import(
          document.querySelector<HTMLScriptElement>(
            'script[src*="/src/main.ts"]',
          )!.src
        );
        return scene.player.anims.currentAnim?.key;
      }),
    )
    .toBe("ninja-attack");
  await touch
    .locator('[data-touch="attack"]')
    .dispatchEvent("pointerup", { pointerId: 4 });
  await touch
    .locator('[data-touch="right"]')
    .dispatchEvent("pointerdown", { pointerId: 5 });
  await expect.poll(async () => (await read()).move).toBe(1);
  await page.evaluate(() =>
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 5 })),
  );
  await expect.poll(async () => (await read()).move).toBe(0);
  await page.screenshot({
    path: "test-results/mobile-touch.png",
    fullPage: true,
  });
});

test("runtime recognition failure retains the preview and frozen video reacquires its stream", async ({
  page,
  context,
}) => {
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
    const { tracker } = await import(
      document.querySelector<HTMLScriptElement>('script[src*="/src/main.ts"]')!
        .src
    );
    const t = tracker as any;
    (window as any).oldStream =
      document.querySelector<HTMLVideoElement>("#webcam")!.srcObject;
    t.delegate = "GPU";
    t.model.detectForVideo = () => {
      throw new Error("simulated context loss");
    };
  });
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const { tracker } = await import(
            document.querySelector<HTMLScriptElement>(
              'script[src*="/src/main.ts"]',
            )!.src
          );
          return (tracker as any).delegate;
        }),
      { timeout: 25000 },
    )
    .toBe("CPU");
  expect(
    await page.evaluate(() => {
      const video = document.querySelector<HTMLVideoElement>("#webcam")!;
      return (
        video.srcObject === (window as any).oldStream &&
        (video.srcObject as MediaStream).getTracks()[0].readyState === "live"
      );
    }),
  ).toBe(true);
  await expect(page.locator("#camera-placeholder")).toBeHidden();
  await page.evaluate(async () => {
    const { tracker } = await import(
      document.querySelector<HTMLScriptElement>('script[src*="/src/main.ts"]')!
        .src
    );
    const video = document.querySelector<HTMLVideoElement>("#webcam")!;
    video.pause();
    (tracker as any).lastFrame = video.currentTime;
    (tracker as any).lastVideoAt = performance.now() - 3000;
  });
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.querySelector<HTMLVideoElement>("#webcam")!.srcObject !==
            (window as any).oldStream,
        ),
      { timeout: 15000 },
    )
    .toBe(true);
  await expect(page.locator("#webcam")).toBeVisible();
  expect(
    await page.evaluate(() =>
      ((window as any).oldStream as MediaStream)
        .getTracks()
        .every((t) => t.readyState === "ended"),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
