// Renders assets/social-preview.html to assets/social-preview.png (1280×640) for the GitHub social preview.
// Usage: npm run social-preview
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";

const html = fileURLToPath(new URL("../assets/social-preview.html", import.meta.url));
const png = fileURLToPath(new URL("../assets/social-preview.png", import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: png });
await browser.close();
console.log(`wrote ${png}`);
