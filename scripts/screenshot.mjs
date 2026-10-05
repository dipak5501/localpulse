// Captures README screenshots with a mocked Long Beach location.
// Usage: node scripts/screenshot.mjs [baseUrl]
import { chromium } from "@playwright/test";

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const LONG_BEACH = { latitude: 33.7701, longitude: -118.1937, accuracy: 25 };

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  geolocation: LONG_BEACH,
  permissions: ["geolocation"],
});
const page = await context.newPage();

await page.goto(baseUrl);
await page.getByText(/Live location/).waitFor();
await page.waitForFunction(() => {
  const tiles = document.querySelectorAll(".leaflet-tile");
  return tiles.length > 0 && document.querySelectorAll(".leaflet-tile-loaded").length === tiles.length;
});
await page.waitForTimeout(800);
await page.screenshot({ path: "docs/screenshot.png" });

await page.getByRole("radio", { name: "Heatmap" }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: "docs/heatmap.png" });

await browser.close();
console.log("Saved docs/screenshot.png and docs/heatmap.png");
