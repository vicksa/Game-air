import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
async function source(page: Page, pending = false) {
  await page.route("**/camera-fixture.jpg", (route) =>
    route.fulfill({
      path: path.resolve("tests/fixtures/hands.jpg"),
      contentType: "image/jpeg",
    }),
  );
  await page.addInitScript((pending) => {
    const makeStream = async () => {
      const image = new Image();
      image.src = "/camera-fixture.jpg";
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      const stream = canvas.captureStream(15);
      const timer = setInterval(() => ctx.drawImage(image, 0, 0), 70);
      for (const track of stream.getTracks()) {
        const stop = track.stop.bind(track);
        track.stop = () => {
          clearInterval(timer);
          stop();
        };
      }
      return stream;
    };
    (window as any).cameraSource = makeStream;
    let calls = 0;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () =>
          pending && ++calls === 1 ? new Promise(() => {}) : makeStream(),
      },
    });
  }, pending);
}
async function probe(page: Page) {
  await page.evaluate(async () => {
    const { tracker } = await import(
      document.querySelector<HTMLScriptElement>('script[src*="/src/main.ts"]')!
        .src
    );
    (window as any).cameraProbe = tracker;
  });
}
test("real model recognizes both photographed hands and releases the stream", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await source(page);
  await page.goto("/");
  await probe(page);
  await page.locator("#camera-start").click();
  await expect(page.locator("#hand-count")).toHaveText("2/2", {
    timeout: 45000,
  });
  await expect(page.locator("#left-hand-state")).toHaveAttribute(
    "data-detected",
    "true",
  );
  await expect(page.locator("#right-hand-state")).toHaveAttribute(
    "data-detected",
    "true",
  );
  const backend = await page.evaluate(
    () => (window as any).cameraProbe.delegate,
  );
  if (info.project.name.includes("no-webgl")) expect(backend).toBe("WASM");
  await page.screenshot({
    path: info.outputPath("recognized-hands.png"),
    fullPage: true,
  });
  await page.evaluate(() => {
    (window as any).fixtureStream =
      document.querySelector<HTMLVideoElement>("#webcam")!.srcObject;
  });
  await page.locator("#camera-off").click();
  expect(
    await page.evaluate(() =>
      ((window as any).fixtureStream as MediaStream)
        .getTracks()
        .every((t) => t.readyState === "ended"),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("manual compatible mode recognizes hands even with the native model unavailable", async ({
  page,
}) => {
  await source(page);
  await page.route("**/models/hand_landmarker.task", (route) => route.abort());
  await page.goto("/");
  await probe(page);
  await page.locator("#camera-start").click();
  await page
    .getByRole("button", { name: "USAR MODO COMPATÍVEL", exact: true })
    .click();
  await expect(page.locator("#hand-count")).toHaveText("2/2", {
    timeout: 45000,
  });
  expect(await page.evaluate(() => (window as any).cameraProbe.delegate)).toBe(
    "WASM",
  );
});
test("pending camera permission can be cancelled and the next attempt works", async ({
  page,
}) => {
  await source(page, true);
  await page.goto("/");
  await page.locator("#camera-start").click();
  await expect(page.locator("#camera-connection-status")).toContainText(
    "permissão",
  );
  await page.getByRole("button", { name: "CANCELAR", exact: true }).click();
  await expect(page.locator("#title-screen")).toBeVisible();
  await page.locator("#camera-start").click();
  await expect(page.locator("#hand-count")).toHaveText("2/2", {
    timeout: 45000,
  });
});
test("denied camera permission gives actionable guidance and keyboard entry", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException("denied", "NotAllowedError");
        },
      },
    });
  });
  await page.goto("/");
  await page.locator("#camera-start").click();
  await expect(page.locator("#camera-error-message")).toContainText(
    "Chrome ou Safari",
  );
  await page
    .getByRole("button", { name: "JOGAR COM TECLADO", exact: true })
    .click();
  await page
    .getByRole("button", { name: "COMEÇAR MISSÃO →", exact: true })
    .click();
  await expect(page.locator("#hud")).toBeVisible();
});

test("compatible recognition also works with touch and a narrow mobile viewport", async ({
  browser,
  browserName,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: browserName !== "firefox",
  });
  try {
    const page = await context.newPage();
    await source(page);
    await page.goto("/");
    await page.locator("#camera-start").click();
    await page
      .getByRole("button", { name: "USAR MODO COMPATÍVEL", exact: true })
      .click();
    await expect(page.locator("#hand-count")).toHaveText("2/2", {
      timeout: 45000,
    });
    await expect(page.locator("#webcam")).toBeVisible();
    await page.locator("#camera-off").click();
    await expect(page.locator("#camera-placeholder")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("empty results recover on native backends and never restart WASM in a loop", async ({
  page,
}) => {
  await source(page);
  await page.goto("/");
  await probe(page);
  await page.locator("#camera-start").click();
  await expect(page.locator("#hand-count")).toHaveText("2/2", {
    timeout: 45000,
  });
  const backend = await page.evaluate(
    () => (window as any).cameraProbe.delegate,
  );
  await page.evaluate(() => {
    const tracker = (window as any).cameraProbe;
    (window as any).originalModel = tracker.model;
    (window as any).originalDetect = tracker.model.detectForVideo;
    (window as any).originalCameraStream =
      document.querySelector<HTMLVideoElement>("#webcam")!.srcObject;
    tracker.model.detectForVideo = () => ({ landmarks: [], handedness: [] });
  });
  await expect(page.locator("#hand-count")).toHaveText("0/2");
  if (backend === "WASM") {
    // Wait beyond the recovery threshold: an already-compatible detector must
    // not reload forever simply because the player has removed both hands.
    await page.waitForTimeout(11000);
    expect(
      await page.evaluate(
        () =>
          (window as any).cameraProbe.model === (window as any).originalModel,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      (window as any).originalModel.detectForVideo = (
        window as any
      ).originalDetect;
    });
  } else {
    await expect
      .poll(() => page.evaluate(() => (window as any).cameraProbe.delegate), {
        timeout: 30000,
      })
      .toBe("WASM");
    expect(
      await page.evaluate(
        () =>
          (window as any).cameraProbe.model === (window as any).originalModel,
      ),
    ).toBe(false);
  }
  await expect(page.locator("#hand-count")).toHaveText("2/2", {
    timeout: 15000,
  });
  expect(
    await page.evaluate(
      () =>
        document.querySelector<HTMLVideoElement>("#webcam")!.srcObject ===
        (window as any).originalCameraStream,
    ),
  ).toBe(true);
});

test("compatible mode remains accessible after successful camera startup", async ({
  page,
}) => {
  await source(page);
  await page.goto("/");
  await probe(page);
  await page.locator("#camera-start").click();
  await expect(page.locator("#hand-count")).toHaveText("2/2", {
    timeout: 45000,
  });
  await page.locator("#monitor-camera-start").click();
  await expect
    .poll(() => page.evaluate(() => (window as any).cameraProbe.delegate), {
      timeout: 30000,
    })
    .toBe("WASM");
  await expect(page.locator("#hand-count")).toHaveText("2/2", {
    timeout: 15000,
  });
});
