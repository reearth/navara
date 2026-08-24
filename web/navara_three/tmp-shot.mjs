/* global process, console */
import { chromium } from "playwright";

const [url, out, waitMs] = process.argv.slice(2);
const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=metal", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({
  viewport: { width: 1920, height: 970 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page
  .goto(url, { waitUntil: "networkidle", timeout: 180000 })
  .catch(() => {});
await page.waitForTimeout(Number(waitMs ?? 20000));
await page.screenshot({ path: out });
console.log(errors.length ? "ERRORS:\n" + errors.slice(0, 4).join("\n") : "ok");
await browser.close();
