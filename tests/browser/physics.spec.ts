import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.locator("#keyboard-start").click();
  await page.getByRole("button", { name: "COMEÇAR MISSÃO" }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const path = document.querySelector<HTMLScriptElement>(
          'script[src*="/src/main.ts"]',
        )!.src;
        const { scene } = await import(path);
        return !!scene.player?.body?.blocked.down && scene.scene.isActive();
      }),
    )
    .toBe(true);
  await page.evaluate(async () => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { scene } = await import(path);
    scene.enemies.clear(true, true);
  });
});
for (const [from, to] of [
  [680, 790],
  [1410, 1540],
  [2230, 2360],
  [3010, 3150],
])
  test(`gap ${from}–${to} is crossable with one jump`, async ({ page }) => {
    await page.evaluate(
      async ({ from }) => {
        const path = document.querySelector<HTMLScriptElement>(
          'script[src*="/src/main.ts"]',
        )!.src;
        const { scene } = await import(path);
        scene.player.setPosition(from - 4, 200).setVelocity(0, 0);
      },
      { from },
    );
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const path = document.querySelector<HTMLScriptElement>(
            'script[src*="/src/main.ts"]',
          )!.src;
          const { scene } = await import(path);
          return scene.player.body.blocked.down;
        }),
      )
      .toBe(true);
    await page.evaluate(async () => {
      const path = document.querySelector<HTMLScriptElement>(
        'script[src*="/src/main.ts"]',
      )!.src;
      const { scene } = await import(path);
      scene.command.move = 1;
      scene.command.jump = true;
    });
    await expect
      .poll(
        () =>
          page.evaluate(
            async ({ to }) => {
              const path = document.querySelector<HTMLScriptElement>(
                'script[src*="/src/main.ts"]',
              )!.src;
              const { scene } = await import(path);
              return scene.player.x > to && scene.player.body.blocked.down;
            },
            { to },
          ),
        { intervals: [20, 30, 50], timeout: 5000 },
      )
      .toBe(true);
    await page.evaluate(async () => {
      const path = document.querySelector<HTMLScriptElement>(
        'script[src*="/src/main.ts"]',
      )!.src;
      const { scene } = await import(path);
      scene.command.move = 0;
    });
    const landed = await page.evaluate(async () => {
      const path = document.querySelector<HTMLScriptElement>(
        'script[src*="/src/main.ts"]',
      )!.src;
      const { scene } = await import(path);
      return {
        x: scene.player.x,
        y: scene.player.y,
        grounded: scene.player.body.blocked.down,
        hp: scene.hp,
      };
    });
    expect(landed.x).toBeGreaterThan(to);
    expect(landed.grounded).toBe(true);
    expect(landed.hp).toBe(5);
  });
test("spikes inflict one hit, invulnerability prevents immediate second hit", async ({
  page,
}) => {
  await page.evaluate(async () => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { scene } = await import(path);
    scene.player.setPosition(540, 323);
  });
  await expect(page.locator("#hearts")).toContainText("◇");
  const hp = await page.evaluate(async () => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { scene } = await import(path);
    scene.damage(1);
    scene.damage(1);
    return scene.hp;
  });
  expect(hp).toBe(4);
});
test("archers fire projectiles then return to idle; projectiles expire", async ({
  page,
}) => {
  await page.evaluate(async () => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { scene } = await import(path);
    scene.player.setPosition(900, 280);
    scene.spawnEnemy(1050, "archer");
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const path = document.querySelector<HTMLScriptElement>(
          'script[src*="/src/main.ts"]',
        )!.src;
        const { scene } = await import(path);
        return scene.shots.getLength();
      }),
    )
    .toBeGreaterThan(0);
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(async () => {
      const path = document.querySelector<HTMLScriptElement>(
        'script[src*="/src/main.ts"]',
      )!.src;
      const { scene } = await import(path);
      return scene.enemies.getChildren()[0].anims.currentAnim.key;
    }),
  ).toBe("archer-idle");
  await page.evaluate(async () => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { scene } = await import(path);
    scene.enemies.clear(true, true);
    for (const s of scene.shots.getChildren())
      s.setData("born", scene.elapsed - 5000);
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const path = document.querySelector<HTMLScriptElement>(
          'script[src*="/src/main.ts"]',
        )!.src;
        const { scene } = await import(path);
        return scene.shots.getLength();
      }),
    )
    .toBe(0);
});
test("reduced effects disable hit flashes and camera shake", async ({
  page,
}) => {
  await page.locator("#reduced-motion").check();
  const result = await page.evaluate(async () => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { scene } = await import(path);
    scene.damage(1);
    return {
      reduced: scene.reducedMotion,
      shake: scene.cameras.main.shakeEffect.isRunning,
    };
  });
  expect(result).toEqual({ reduced: true, shake: false });
  await page.waitForTimeout(100);
  expect(
    await page.evaluate(async () => {
      const path = document.querySelector<HTMLScriptElement>(
        'script[src*="/src/main.ts"]',
      )!.src;
      const { scene } = await import(path);
      return scene.player.alpha;
    }),
  ).toBe(1);
});
