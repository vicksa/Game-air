import { test, expect } from "@playwright/test";
test("desktop stage uses more width and fullscreen enlarges the actual canvas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.locator("#keyboard-start").click();
  await page.getByRole("button", { name: "COMEÇAR MISSÃO" }).click();
  const before = await page.locator("#game canvas").boundingBox();
  expect(before!.width).toBeGreaterThan(1100);
  await page.locator("#fullscreen").click();
  await expect(page.locator("#fullscreen")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect
    .poll(async () => (await page.locator("#game canvas").boundingBox())!.width)
    .toBeGreaterThan(before!.width * 1.12);
  await expect(page.locator(".monitor-viewport")).toBeInViewport();
  await page.screenshot({
    path: "test-results/fullscreen-desktop.png",
    fullPage: true,
  });
  await page.locator("#fullscreen").click();
  await expect(page.locator("#fullscreen")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect
    .poll(async () =>
      Math.round((await page.locator("#game canvas").boundingBox())!.width),
    )
    .toBe(Math.round(before!.width));
});
test("fullscreen keeps the same live camera stream", async ({
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
  await page.evaluate(() => {
    (window as any).fullscreenStream =
      document.querySelector<HTMLVideoElement>("#webcam")!.srcObject;
  });
  await page.locator("#fullscreen").click();
  await expect(page.locator("#fullscreen")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#webcam")).toBeInViewport();
  await page.locator("#fullscreen").click();
  expect(
    await page.evaluate(() => {
      const stream = (window as any).fullscreenStream as MediaStream;
      return (
        document.querySelector<HTMLVideoElement>("#webcam")!.srcObject ===
          stream && stream.getTracks().every((t) => t.readyState === "live")
      );
    }),
  ).toBe(true);
});
test("mobile fallback expands without hiding touch controls or the exit button", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  try {
    await page.addInitScript(() => {
      Element.prototype.requestFullscreen = async () => {
        throw new Error("unsupported");
      };
    });
    await page.goto("/");
    await page.locator("#keyboard-start").click();
    await page.getByRole("button", { name: "COMEÇAR MISSÃO" }).click();
    await page.locator("#fullscreen").click();
    await expect(page.locator("#game-shell")).toHaveClass("expanded");
    await expect(page.locator("#fullscreen")).toBeInViewport();
    await expect(page.locator('[data-touch="jump"]')).toBeInViewport();
    await expect(page.locator(".monitor-viewport")).toBeInViewport();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const canvas = document
            .querySelector("#game canvas")!
            .getBoundingClientRect();
          const stage = document
            .querySelector(".play-stage")!
            .getBoundingClientRect();
          return (
            canvas.width <= stage.width + 1 &&
            canvas.height <= stage.height + 1 &&
            canvas.y >= stage.y - 1
          );
        }),
      )
      .toBe(true);
    expect(
      (await page.locator("#game canvas").boundingBox())!.width,
    ).toBeGreaterThan(600);
    await page.screenshot({
      path: "test-results/fullscreen-mobile.png",
      fullPage: true,
    });
    await page.locator("#fullscreen").click();
    await expect(page.locator("body")).not.toHaveClass("game-expanded");
  } finally {
    await context.close();
  }
});
