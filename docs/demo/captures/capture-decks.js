/**
 * Capture rendered slides from canton-interview.html and canton-homework-deck.html.
 * Each .slide-container is 1280x720 — we screenshot the element so you get text + chrome,
 * not just the ambient background.
 *
 * Usage:
 *   1) python3 -m http.server 8765 --bind 127.0.0.1 --directory <repo>/docs/demo  (separate shell)
 *   2) node capture-decks.js
 */
const path = require("node:path");
const { chromium } = require("/home/naim/.hermes/hermes-agent/node_modules/playwright");

const HOST = process.env.CAPTURE_HOST || "http://127.0.0.1:8765";
const OUT_ROOT = path.resolve(__dirname);

const DECKS = [
  { file: "canton-interview.html", out: "canton-interview", slides: 9 },
  { file: "canton-homework-deck.html", out: "canton-homework", slides: 14 },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1320, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  for (const deck of DECKS) {
    const url = `${HOST}/${deck.file}`;
    console.log(`\n--- ${deck.file} -> ${deck.out}/ ---`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    // Allow web fonts + IntersectionObserver reveal to settle
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    for (let i = 0; i < deck.slides; i++) {
      const sel = `#slide-${i}`;
      const el = await page.$(sel);
      if (!el) {
        console.error(`  miss: ${sel}`);
        continue;
      }
      await el.scrollIntoViewIfNeeded();
      // brief settle for any reveal animation tied to scroll/IO
      await page.waitForTimeout(350);
      const out = path.join(OUT_ROOT, deck.out, `slide-${i}.jpg`);
      await el.screenshot({ path: out, type: "jpeg", quality: 85 });
      const stats = require("node:fs").statSync(out);
      console.log(`  ${sel} -> ${path.relative(OUT_ROOT, out)} (${stats.size} bytes)`);
    }
  }

  await browser.close();
  console.log("\ndone.");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
