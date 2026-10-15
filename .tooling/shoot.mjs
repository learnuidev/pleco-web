/**
 * Verification harness: drives the running dev server with a real browser and
 * captures screenshots of each view/state. Development tooling, not app code.
 *
 *   node .tooling/shoot.mjs [baseUrl] [outDir]
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:4310";
const OUT = path.resolve(process.argv[3] ?? ".tooling/shots");

const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
    colorScheme: "light",
  });
  const page = await context.newPage();

  const problems = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("requestfinished", async (request) => {
    try {
      const response = await request.response();
      if (response && response.status() >= 400) {
        problems.push(`HTTP ${response.status()} ${String(request.url())}`);
      }
    } catch {
      // ignore
    }
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()} ${String(response.url())}`);
  });

  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log(`  shot ${name}`);
  };

  const search = () => page.getByPlaceholder(/Search Chinese/);
  const results = () => page.locator("main ul li button").first();
  const tab = (name) => page.locator("main button", { hasText: name }).first();

  console.log(`→ ${BASE}`);
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await shot("01-empty-state");

  // ---- pinyin search -------------------------------------------------------
  await search().click();
  await search().fill("xue");
  await results().waitFor({ timeout: 20000 });
  await page.waitForTimeout(500);
  await shot("02-search-pinyin");

  // Open the first result (学) and let the stroke animation settle.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await results().click();
  await page.waitForTimeout(3200);
  await shot("03-entry-strokes");

  await page.getByRole("button", { name: "Characters", exact: true }).first().click();
  await page.waitForTimeout(900);
  await shot("04-characters");

  await page.getByRole("button", { name: "Examples", exact: true }).first().click();
  await page.waitForTimeout(1100);
  await shot("05-examples");

  await page.getByRole("button", { name: "Details", exact: true }).first().click();
  await page.waitForTimeout(700);
  await shot("06-details");

  await page.getByRole("button", { name: "Strokes", exact: true }).first().click();
  await page.waitForTimeout(600);

  // Quiz mode + a wrong-ish drawing attempt, to prove grading renders.
  await page.getByRole("button", { name: "Quiz", exact: true }).first().click();
  await page.waitForTimeout(1400);
  const canvas = page.locator("main div[class*='cursor-crosshair']").first();
  if (await canvas.count()) {
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 12 });
      await page.mouse.up();
    }
  }
  await page.waitForTimeout(900);
  await shot("07-stroke-quiz");

  await page.getByRole("button", { name: "Animate", exact: true }).first().click();
  await page.waitForTimeout(500);

  // ---- chinese + english search -------------------------------------------
  await search().click();
  await search().fill("学习");
  await page.waitForTimeout(1200);
  await shot("08-search-chinese");

  await search().fill("snow");
  await page.waitForTimeout(1200);
  await shot("09-search-english");

  await search().fill("hello world");
  await page.waitForTimeout(1400);
  await shot("10-search-english-phrase");

  // ---- text viewer ---------------------------------------------------------
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.waitForTimeout(400);
  const textarea = page.locator("textarea").first();
  await textarea.click();
  await textarea.fill("今天天气很好，我们一起去公园散步吧。你学习中文多久了？");
  await page.waitForTimeout(1800);
  await shot("11-text-reader");

  // ---- browse --------------------------------------------------------------
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await page.waitForTimeout(1500);
  await shot("12-browse-common");

  await page.getByRole("button", { name: "By strokes", exact: true }).click();
  await page.waitForTimeout(1500);
  await shot("13-browse-strokes");

  await page.getByRole("button", { name: "Radicals", exact: true }).click();
  await page.waitForTimeout(1800);
  await shot("14-browse-radicals");

  // ---- saved ---------------------------------------------------------------
  await page.locator("aside button").filter({ hasText: "Saved words" }).click();
  await page.waitForTimeout(600);
  await shot("15-saved-empty");

  // Save a word from the reader, then export.
  await page.getByRole("button", { name: "Dictionary", exact: true }).click();
  await search().click();
  await search().fill("爱");
  await page.waitForTimeout(1300);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await results().click();
  await page.waitForTimeout(3200);
  const saveButton = page.locator("main").getByRole("button", { name: /^Save$/ }).first();
  if (await saveButton.count()) {
    await saveButton.click();
    await page.waitForTimeout(500);
  }
  await shot("16-entry-saved");

  await search().fill("雪");
  await page.waitForTimeout(1300);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await results().click();
  await page.waitForTimeout(2400);
  const saveButton2 = page.locator("main").getByRole("button", { name: /^Save$/ }).first();
  if (await saveButton2.count()) {
    await saveButton2.click();
    await page.waitForTimeout(400);
  }

  await page.locator("aside button").filter({ hasText: "Saved words" }).click();
  await page.getByRole("button", { name: /^Export$/ }).first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(600);
  await shot("17-saved-list");

  const exportButton = page.getByRole("button", { name: /^Export$/ }).first();
  if (await exportButton.count()) {
    await exportButton.click();
    await page.waitForTimeout(900);
    await shot("18-export-dialog");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  } else {
    console.log("  (saved list empty — skipped export dialog)");
  }

  // ---- dark appearance -----------------------------------------------------
  await page.getByRole("button", { name: "Dictionary", exact: true }).click();
  await search().click();
  await search().fill("你");
  await page.waitForTimeout(1300);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await results().click();
  await page.waitForTimeout(3000);

  await page.getByRole("button", { name: "Switch to dark appearance" }).click();
  await page.waitForTimeout(900);
  await shot("19-dark-entry");

  await page.getByRole("button", { name: "Characters", exact: true }).first().click();
  await page.waitForTimeout(900);
  await shot("20-dark-characters");

  await page.getByRole("button", { name: "Switch to light appearance" }).click();
  await page.waitForTimeout(600);

  // ---- narrow desktop ------------------------------------------------------
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.getByRole("button", { name: "Strokes", exact: true }).first().click();
  await page.waitForTimeout(1200);
  await shot("21-narrow");

  await browser.close();

  console.log(problems.length ? `\nproblems:\n  - ${problems.join("\n  - ")}` : "\nno console errors");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
