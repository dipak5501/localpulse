import { expect, test, type Page } from "@playwright/test";

const LONG_BEACH = { latitude: 33.7701, longitude: -118.1937, accuracy: 20 };

const feedCount = async (page: Page) => {
  const heading = await page.getByRole("heading", { name: /Trending nearby/ }).textContent();
  return Number(heading?.match(/(\d+)/)?.[1]);
};

test.describe("with location access", () => {
  test.use({ geolocation: LONG_BEACH, permissions: ["geolocation"] });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Live location/)).toBeVisible();
  });

  test("shows a ranked feed of nearby pulses on the map", async ({ page }) => {
    expect(await feedCount(page)).toBeGreaterThan(5);
    await expect(page.locator(".leaflet-interactive").first()).toBeVisible();
  });

  test("shrinking the radius never shows more pulses", async ({ page }) => {
    const before = await feedCount(page);
    await page.getByLabel("Search radius").fill("1");
    await expect.poll(() => feedCount(page)).toBeLessThanOrEqual(before);
  });

  test("category filters hide that category from the feed", async ({ page }) => {
    const feed = page.getByRole("list");
    const alerts = page.getByRole("group", { name: "Filter by category" }).getByRole("button", { name: "Alerts" });
    await expect(feed.getByText("Alerts", { exact: true }).first()).toBeVisible();
    await alerts.click();
    await expect(alerts).toHaveAttribute("aria-pressed", "false");
    await expect(feed.getByText("Alerts", { exact: true })).toHaveCount(0);
  });

  test("posting a pulse adds it to the feed and survives a reload", async ({ page }) => {
    const text = `E2E pulse ${Date.now()}`;
    await page.getByPlaceholder("What's happening on this block?").fill(text);
    await page.getByLabel("Category", { exact: true }).selectOption("music");
    await page.getByRole("button", { name: "Pulse it" }).click();

    const item = page.getByRole("listitem").filter({ hasText: text });
    await expect(item).toContainText("Music");
    await expect(item).toContainText("@you");

    await page.reload();
    await expect(page.getByRole("listitem").filter({ hasText: text })).toBeVisible();
  });

  test("you can delete your own pulse but not other people's", async ({ page }) => {
    const text = `Delete me ${Date.now()}`;
    await page.getByPlaceholder("What's happening on this block?").fill(text);
    await page.getByRole("button", { name: "Pulse it" }).click();

    await expect(page.getByRole("button", { name: /^Delete "/ })).toHaveCount(1);
    await page.getByRole("button", { name: `Delete "${text}"` }).click();
    await expect(page.getByRole("listitem").filter({ hasText: text })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("listitem").filter({ hasText: text })).toHaveCount(0);
  });

  test("upvotes toggle and persist", async ({ page }) => {
    const upvote = page.getByRole("button", { name: /^Upvote "/ }).first();
    const label = await upvote.getAttribute("aria-label");
    const before = Number(await upvote.textContent());

    await upvote.click();
    const voted = page.getByRole("button", { name: label!.replace(/^Upvote/, "Remove upvote from") });
    await expect(voted).toHaveAttribute("aria-pressed", "true");
    await expect(voted).toHaveText(String(before + 1));

    await page.reload();
    await expect(voted).toHaveAttribute("aria-pressed", "true");
  });

  test("heatmap mode draws a heat layer instead of markers", async ({ page }) => {
    await page.getByRole("radio", { name: "Heatmap" }).click();
    await expect(page.locator(".leaflet-overlay-pane canvas")).toHaveCount(1);
    await page.getByRole("radio", { name: "Pulses" }).click();
    await expect(page.locator(".leaflet-overlay-pane canvas")).toHaveCount(0);
  });

  test("shows a place brief and an Access map mode", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /living brief for the ground/i })).toBeVisible();
    await expect(page.getByLabel("Place brief")).toBeVisible();
    // Wait for access summary chips (live OSM/Google or labeled sample).
    await expect(page.getByLabel("Place brief").getByText("Care")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel("Coastal and seismic brief")).toBeVisible({ timeout: 25_000 });
    await page.getByRole("radio", { name: "Access" }).click();
    await expect(page.getByRole("radio", { name: "Access" })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator(".leaflet-interactive").first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("without location access", () => {
  test.use({ permissions: [] });

  test("falls back to Long Beach", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Showing Long Beach, CA instead/)).toBeVisible({ timeout: 15_000 });
    expect(await feedCount(page)).toBeGreaterThan(0);
  });

  test("honors a shared ?lat=&lng= deep link", async ({ page }) => {
    await page.goto("/?lat=33.77010&lng=-118.19370");
    await expect(page.getByText(/Showing a shared map link/)).toBeVisible();
    expect(await feedCount(page)).toBeGreaterThan(0);
  });
});
