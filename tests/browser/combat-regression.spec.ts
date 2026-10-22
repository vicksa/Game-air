import { test, expect, type Page } from "@playwright/test";
async function start(page: Page) {
  await page.goto("/");
  await page.locator("#keyboard-start").click();
  await page
    .getByRole("button", { name: "COMEÇAR MISSÃO →", exact: true })
    .click();
}
for (const offset of [0, -35, 35]) {
  test(`a normal guard with all three health points can be defeated at offset ${offset}`, async ({
    page,
  }) => {
    await start(page);
    await page.evaluate(async (offset) => {
      const { scene } = await import(
        document.querySelector<HTMLScriptElement>(
          'script[src*="/src/main.ts"]',
        )!.src
      );
      const guard = scene.enemies
        .getChildren()
        .find((e: any) => e.kind === "guard");
      for (const e of [...scene.enemies.getChildren()])
        if (e !== guard) e.destroy();
      guard.setPosition(300 + offset, 300);
      guard.setVelocity(0, 0);
      scene.player.setPosition(300, 300);
      scene.hurtUntil = scene.elapsed + 6000;
      (window as any).combatGuard = guard;
      (window as any).combatTimer = setInterval(() => {
        scene.command.attack = true;
      }, 600);
    }, offset);
    // Preserve real enemy health, AI, hit windows and cooldowns.
    await expect
      .poll(() => page.evaluate(() => (window as any).combatGuard.dying), {
        timeout: 6000,
      })
      .toBe(true);
    await expect(page.locator("#score")).toHaveText("01");
    await page.evaluate(() => clearInterval((window as any).combatTimer));
  });
}
