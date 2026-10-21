import { test, expect, type Page } from "@playwright/test";
async function start(page: Page) {
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
}
test("an actual attack plays every authored frame before returning to idle", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(async () => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { scene } = await import(path);
    (window as any).attackFrames = [];
    const capture = (a: any, f: any) => {
      if (a.key === "ninja-attack")
        (window as any).attackFrames.push(Number(f.textureFrame));
    };
    scene.player.on("animationupdate", capture);
    scene.player.on("animationstart", capture);
  });
  await page.keyboard.press("j");
  await page.waitForTimeout(650);
  const frames = await page.evaluate(() => (window as any).attackFrames);
  expect(new Set(frames)).toEqual(new Set([18, 19, 20, 21, 22]));
});
test("defeated enemies play death instead of disappearing immediately", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(async () => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { scene } = await import(path);
    scene.spawnEnemy(125, "guard");
    const e = scene.enemies.getChildren()[0];
    e.hp = 1;
    scene.hurtUntil = scene.time.now + 5000;
  });
  await page.keyboard.press("j");
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const path = document.querySelector<HTMLScriptElement>(
            'script[src*="/src/main.ts"]',
          )!.src;
          const { scene } = await import(path);
          return scene.enemies.getChildren()[0]?.anims.currentAnim?.key;
        }),
      { intervals: [20, 30, 50] },
    )
    .toBe("guard-death");
  const state = await page.evaluate(async () => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { scene } = await import(path);
    return scene.enemies.getChildren().map((e: any) => ({
      animation: e.anims.currentAnim?.key,
      body: e.body.enable,
    }));
  });
  expect(state).toEqual([{ animation: "guard-death", body: false }]);
  await page.waitForTimeout(600);
  expect(
    await page.evaluate(async () => {
      const path = document.querySelector<HTMLScriptElement>(
        'script[src*="/src/main.ts"]',
      )!.src;
      const { scene } = await import(path);
      return scene.enemies.getLength();
    }),
  ).toBe(0);
});
test("all 28 sprite sequences reference real transparent frames and animate", async ({
  page,
}) => {
  await page.goto("/sprites.html");
  await expect(page.locator("#gallery canvas")).toHaveCount(28);
  await expect(page.locator("#toggle")).toHaveText("PAUSAR ANIMAÇÕES");
  const results = await page.evaluate(async () => {
    const atlas = await (await fetch("/assets/atlas.json")).json();
    const results = [];
    for (const [kind, states] of Object.entries(atlas.animations)) {
      const image = new Image();
      image.src = `/assets/${kind}.png`;
      await image.decode();
      const c = document.createElement("canvas");
      c.width = c.height = 48;
      const ctx = c.getContext("2d")!;
      for (const [state, anim] of Object.entries(states as any)) {
        const hashes = [];
        for (const f of (anim as any).frames) {
          ctx.clearRect(0, 0, 48, 48);
          ctx.drawImage(
            image,
            (f % 6) * 48,
            Math.floor(f / 6) * 48,
            48,
            48,
            0,
            0,
            48,
            48,
          );
          const pixels = ctx.getImageData(0, 0, 48, 48).data;
          let opaque = 0,
            transparent = 0;
          for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i]) opaque++;
            else transparent++;
          }
          if (opaque < 30 || transparent < 30)
            throw new Error(`${kind}-${state} invalid transparency`);
          hashes.push(Array.from(pixels).join(","));
        }
        results.push({ kind, state, unique: new Set(hashes).size });
      }
    }
    return results;
  });
  expect(results).toHaveLength(28);
  for (const r of results)
    expect(
      r.unique,
      `${r.kind}-${r.state} needs distinct poses`,
    ).toBeGreaterThan(1);
  await page.screenshot({
    path: "test-results/sprite-gallery.png",
    fullPage: true,
  });
  await page.locator("#toggle").click();
  const first = await page
    .locator("#gallery canvas")
    .first()
    .evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await page.waitForTimeout(250);
  expect(
    await page
      .locator("#gallery canvas")
      .first()
      .evaluate((c: HTMLCanvasElement) => c.toDataURL()),
  ).toBe(first);
});
test("help during webcam calibration does not break tracking", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["camera"]);
  await page.goto("/");
  await page.locator("#camera-start").click();
  await expect(page.locator("#modal-title")).toHaveText(
    "Encontre seu equilíbrio.",
    { timeout: 25000 },
  );
  await page.locator("#help").click();
  await page.waitForTimeout(300);
  await expect(page.locator("#modal-title")).toHaveText(
    "Suas mãos fazem a história.",
  );
  await expect(page.locator("#camera-error-message")).toHaveCount(0);
});
test("all 28 registered Phaser animations advance through their atlas frames", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(async () => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { scene } = await import(path);
    const atlas = await (await fetch("/assets/atlas.json")).json();
    const records: any[] = [];
    (window as any).animationRecords = records;
    scene.add.rectangle(320, 190, 600, 280, 0x17223b).setDepth(30);
    let col = 0;
    for (const [kind, states] of Object.entries(atlas.animations)) {
      let row = 0;
      for (const [state, definition] of Object.entries(states as any)) {
        const key = `${kind}-${state}`;
        const sprite = scene.add
          .sprite(110 + col * 135, 90 + row * 35, kind)
          .setDepth(31);
        const record = {
          key,
          expected: (definition as any).frames,
          frames: [] as number[],
          completed: false,
        };
        records.push(record);
        const capture = (_a: any, f: any) =>
          record.frames.push(Number(f.textureFrame));
        sprite.on("animationstart", capture);
        sprite.on("animationupdate", capture);
        sprite.once("animationcomplete", () => (record.completed = true));
        sprite.play(key);
        scene.add
          .text(132 + col * 135, 85 + row * 35, state, {
            fontSize: "7px",
            color: "#ffc477",
          })
          .setDepth(31);
        row++;
      }
      col++;
    }
  });
  await page.waitForTimeout(1050);
  const records = await page.evaluate(() => (window as any).animationRecords);
  for (const r of records) {
    expect(new Set(r.frames), r.key).toEqual(new Set(r.expected));
    if (!["idle", "run", "defend"].some((s) => r.key.endsWith(`-${s}`)))
      expect(r.completed, r.key).toBe(true);
  }
  await page.screenshot({
    path: "test-results/animation-playback.png",
    fullPage: true,
  });
});
test("walking, facing, jump, defense, hurt and pause use the right animation", async ({
  page,
}) => {
  await start(page);
  await page.waitForTimeout(300);
  const state = () =>
    page.evaluate(async () => {
      const path = document.querySelector<HTMLScriptElement>(
        'script[src*="/src/main.ts"]',
      )!.src;
      const { scene } = await import(path);
      return {
        key: scene.player.anims.currentAnim?.key,
        frame: Number(scene.player.frame.name),
        flip: scene.player.flipX,
        y: scene.player.y,
      };
    });
  await page.keyboard.down("a");
  await expect.poll(async () => (await state()).key).toBe("ninja-run");
  expect((await state()).flip).toBe(true);
  await page.keyboard.up("a");
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
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state()).key).toBe("ninja-jump");
  await page.waitForTimeout(1000);
  await page.keyboard.down("k");
  await expect.poll(async () => (await state()).key).toBe("ninja-defend");
  await page.keyboard.press("Escape");
  const frozen = await state();
  await page.waitForTimeout(250);
  expect(await state()).toEqual(frozen);
  await page.keyboard.up("k");
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await state()).key).toBe("ninja-idle");
  await page.evaluate(async () => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { scene } = await import(path);
    scene.defending = false;
    scene.damage(1);
  });
  await expect.poll(async () => (await state()).key).toBe("ninja-hurt");
});
test("an enemy hit reaction reaches its second frame during actual combat", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(async () => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { scene } = await import(path);
    scene.spawnEnemy(125, "guard");
    scene.hurtUntil = scene.time.now + 2000;
    (window as any).hurtFrames = [];
    const e = scene.enemies.getChildren()[0];
    const capture = (a: any, f: any) => {
      if (a.key === "guard-hurt")
        (window as any).hurtFrames.push(Number(f.textureFrame));
    };
    e.on("animationstart", capture);
    e.on("animationupdate", capture);
  });
  await page.keyboard.press("j");
  await expect
    .poll(() => page.evaluate(() => (window as any).hurtFrames.includes(31)), {
      intervals: [20, 50, 100],
      timeout: 1500,
    })
    .toBe(true);
});
test("the last hit publishes zero health before the defeat screen freezes play", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(async () => {
    const path = document.querySelector<HTMLScriptElement>(
      'script[src*="/src/main.ts"]',
    )!.src;
    const { scene } = await import(path);
    scene.hp = 1;
    scene.hurtUntil = 0;
    scene.lastHud = scene.time.now;
    scene.damage(1);
  });
  await expect(page.locator("#modal-title")).toHaveText("O caminho continua.");
  expect((await page.locator("#hearts").innerText()).replaceAll(" ", "")).toBe(
    "◇◇◇◇◇",
  );
});
