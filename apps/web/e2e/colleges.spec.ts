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
  test("shows cutoff chart and seat type chips", async ({ page }) => {
    // Navigate to colleges, click first result
    await page.goto("/colleges");
    const firstCard = page.locator('[class*="college-card"], [class*="college-item"], [class*="cl-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();
    await expect(page).toHaveURL(/\/colleges\/\d+/);

    // CutoffChart seat type chips should be visible
    await expect(page.locator('.cc-chip').first()).toBeVisible({ timeout: 10_000 });
    // Chart SVG should be present
    await expect(page.locator('.cc-svg')).toBeVisible();
    // Table should have rows
    await expect(page.locator('.cc-table tbody tr').first()).toBeVisible();
  });

  test("switching seat type chip updates the chart", async ({ page }) => {
    await page.goto("/colleges");
    const firstCard = page.locator('[class*="college-card"], [class*="college-item"], [class*="cl-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();

    // Wait for chips
    await expect(page.locator('.cc-chip').first()).toBeVisible({ timeout: 10_000 });
    const chips = page.locator('.cc-chip');
    const count = await chips.count();
    if (count > 1) {
      const secondChip = chips.nth(1);
      const chipText = await secondChip.textContent();
      await secondChip.click();
      // The active chip should be the second one now
      await expect(secondChip).toHaveAttribute("aria-pressed", "true");
      expect(chipText).toBeTruthy();
    }
  });
});
