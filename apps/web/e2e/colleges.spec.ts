import { test, expect } from "@playwright/test";

test.describe("Colleges list", () => {
  test("loads and shows college cards", async ({ page }) => {
    await page.goto("/colleges");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // At least one college card should appear once the API responds
    await expect(page.locator('[class*="college-card"], [class*="college-item"], [class*="cl-card"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test("search filters colleges", async ({ page }) => {
    await page.goto("/colleges");
    const searchInput = page.getByRole("textbox");
    await searchInput.fill("COEP");
    await page.waitForTimeout(500); // debounce
    const cards = page.locator('[class*="college-card"], [class*="college-item"], [class*="cl-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 8_000 });
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(20); // filtered, not full list
  });

  test("clicking a college opens its cutoff page", async ({ page }) => {
    await page.goto("/colleges");
    // Wait for at least one college to load
    const firstCard = page.locator('[class*="college-card"], [class*="college-item"], [class*="cl-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();
    // College page URL should include /colleges/
    await expect(page).toHaveURL(/\/colleges\/\d+/);
    // Should show the college name as a heading
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("College cutoff page", () => {
  test("shows cutoff chart with category chips and SVG bars", async ({ page }) => {
    await page.goto("/colleges");
    const firstCard = page.locator('[class*="college-card"], [class*="college-item"], [class*="cl-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();
    await expect(page).toHaveURL(/\/colleges\/\d+/);

    // Category filter chips should be visible
    await expect(page.locator('.cc-cat-chip').first()).toBeVisible({ timeout: 10_000 });
    // At least one chip should be active by default
    await expect(page.locator('.cc-cat-chip.active').first()).toBeVisible();
    // SVG bar chart should be present
    await expect(page.locator('.cc-svg')).toBeVisible();
  });

  test("toggling a category chip updates the chart", async ({ page }) => {
    await page.goto("/colleges");
    const firstCard = page.locator('[class*="college-card"], [class*="college-item"], [class*="cl-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();

    await expect(page.locator('.cc-cat-chip').first()).toBeVisible({ timeout: 10_000 });
    const chips = page.locator('.cc-cat-chip');
    const count = await chips.count();
    if (count > 1) {
      // Toggle a second chip on
      const secondChip = chips.nth(1);
      const wasActive = await secondChip.evaluate((el) => el.classList.contains("active"));
      await secondChip.click();
      const isNowActive = await secondChip.evaluate((el) => el.classList.contains("active"));
      expect(isNowActive).toBe(!wasActive);
    }
  });

  test("hovering a bar shows the tooltip with round data", async ({ page }) => {
    await page.goto("/colleges");
    const firstCard = page.locator('[class*="college-card"], [class*="college-item"], [class*="cl-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();

    await expect(page.locator('.cc-svg')).toBeVisible({ timeout: 10_000 });
    // Hover the first bar rect in the SVG
    const firstBar = page.locator('.cc-svg rect').first();
    await firstBar.hover();
    // Tooltip should appear
    await expect(page.locator('.cc-tooltip')).toBeVisible({ timeout: 3_000 });
    // Tooltip should contain round rows
    await expect(page.locator('.cc-tt-row').first()).toBeVisible();
  });
});
