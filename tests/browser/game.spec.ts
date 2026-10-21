import { expect, test } from "@playwright/test";
test("title, tutorial, play, movement, pause and restart", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#game canvas")).toBeVisible();
  await page.screenshot({ path: "test-results/title.png", fullPage: true });
  await page.locator("#keyboard-start").click();
  await expect(page.locator("#modal-title")).toHaveText("Entre no dojo.");
  await page.getByRole("button", { name: "COMEÇAR MISSÃO" }).click();
  await expect(page.locator("#hud")).toBeVisible();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(850);
  await page.keyboard.press("Space");
  await page.waitForTimeout(350);
  await page.keyboard.up("ArrowRight");
  await expect(page.locator("#progress")).not.toHaveAttribute(
    "style",
    "width: 0%;",
  );
  await page.screenshot({ path: "test-results/gameplay.png", fullPage: true });
  await page.keyboard.press("Escape");
  await expect(page.locator("#modal-title")).toHaveText(
    "Uma pausa no telhado.",
  );
  await page.getByRole("button", { name: "CONTINUAR →", exact: true }).click();
  await expect(page.locator("#modal")).toBeHidden();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "VOLTAR AO INÍCIO" }).click();
  await expect(page.locator("#title-screen")).toBeVisible();
  expect(errors).toEqual([]);
});
test("camera denial offers keyboard alternative without uncaught errors", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied", "NotAllowedError");
    };
  });
  await page.goto("/");
  await page.locator("#camera-start").click();
  await expect(page.locator("#modal-title")).toHaveText(
    "A câmera precisa de atenção.",
  );
  await expect(page.locator("#camera-error-message")).toContainText(
    "não autorizou",
  );
  await page
    .getByRole("button", { name: "JOGAR COM TECLADO", exact: true })
    .click();
  await expect(page.locator("#modal-title")).toHaveText("Entre no dojo.");
});
test("small screens keep title and primary action usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#camera-start")).toBeInViewport({ ratio: 1 });
  await expect(page.locator("#keyboard-start")).toBeInViewport({ ratio: 1 });
  const button = await page.locator("#keyboard-start").boundingBox();
  const cabinet = await page.locator(".cabinet").boundingBox();
  expect(button!.y + button!.height).toBeLessThan(cabinet!.y + cabinet!.height);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});

test("local MediaPipe runtime boots with a synthetic camera and waits for hands", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["camera"]);
  const failures: string[] = [];
  page.on("pageerror", (e) => failures.push(e.message));
  const external: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:5173") &&
      !r.url().startsWith("blob:") &&
      !r.url().startsWith("data:")
    )
      external.push(r.url());
  });
  await page.goto("/");
  await page.locator("#camera-start").click();
  await expect(page.locator("#modal-title")).toHaveText(
    "Encontre seu equilíbrio.",
    { timeout: 25000 },
  );
  await expect(page.locator("#calibration-status")).toHaveText(
    "Aguardando as duas mãos…",
  );
  await expect(page.locator("#camera-off")).toBeVisible();
  await page.locator("#camera-off").click();
  await expect(page.locator("#camera-placeholder")).toBeVisible();
  expect(failures).toEqual([]);
  expect(external).toEqual([]);
});
test("checkpoint, falling damage, defeat and fresh restart", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#keyboard-start").click();
  await page.getByRole("button", { name: "COMEÇAR MISSÃO" }).click();
  await page.evaluate(async () => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { scene } = await import(path);
    scene.player.setPosition(2000, 200);
  });
  await expect(page.locator("#toast")).toHaveText(
    "REFÚGIO ALCANÇADO · +2 VIDA",
  );
  await page.evaluate(async () => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { scene } = await import(path);
    scene.player.setPosition(2250, 420);
  });
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const path = document.querySelector<HTMLScriptElement>(
          'script[src*="/src/main.ts"]',
        )!.src;
        const { scene } = await import(path);
        return Math.round(scene.player.x);
      }),
    )
    .toBe(1980);
  await expect(page.locator("#hearts")).toContainText("◇");
  await page.evaluate(async () => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { scene } = await import(path);
    scene.hp = 1;
    scene.player.setPosition(2250, 420);
  });
  await expect(page.locator("#modal-title")).toHaveText("O caminho continua.");
  await page.getByRole("button", { name: "JOGAR NOVAMENTE" }).click();
  await expect(page.locator("#modal")).toBeHidden();
  await expect(page.locator("#hearts")).not.toContainText("◇");
});
test("defense blocks contact, attacks damage the boss and victory is reachable", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#keyboard-start").click();
  await page.getByRole("button", { name: "COMEÇAR MISSÃO" }).click();
  await page.evaluate(async () => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { scene } = await import(path);
    for (const e of [...scene.enemies.getChildren()])
      if (e.kind !== "boss") e.destroy();
    scene.player.setPosition(3790, 300);
    scene.hurtUntil = 0;
  });
  await page.keyboard.down("k");
  await page.waitForTimeout(500);
  await expect(page.locator("#hearts")).not.toContainText("◇");
  await page.keyboard.up("k");
  // Set up a one-hit encounter to test the real collision/attack/victory path.
  await page.evaluate(async () => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { scene } = await import(path);
    const boss = scene.enemies.getChildren()[0];
    boss.hp = 1;
    boss.setPosition(3840, 300);
    scene.player.setPosition(3790, 300);
    scene.hurtUntil = scene.elapsed + 3000;
  });
  await page.keyboard.press("j");
  await expect(page.locator("#modal-title")).toHaveText("O amanhecer é seu.");
  await page.screenshot({ path: "test-results/victory.png", fullPage: true });
});
