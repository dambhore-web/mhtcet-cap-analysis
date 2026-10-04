// Renders scripts/og-image.html to public/og-image.png (1200 × 630), the share image every page uses.
// Run it after changing the HTML and commit the PNG: the build doesn't regenerate it.
// Usage: node scripts/og-image.mjs   (from apps/web; needs the Playwright browsers: npm run e2e:install)
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const html = fileURLToPath(new URL("./og-image.html", import.meta.url));
const out = fileURLToPath(new URL("../public/og-image.png", import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(`file://${html}`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out });
await browser.close();
console.log(`[og-image] wrote ${out}`);
