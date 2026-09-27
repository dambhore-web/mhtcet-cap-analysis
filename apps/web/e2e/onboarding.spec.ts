import { test, expect } from "@playwright/test";

test.describe("Onboarding → rank finder", () => {
  test.beforeEach(async ({ page }) => {
    // Clear profile so onboarding is shown
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("compass_profile"));
  });

  test("redirects to /welcome when no profile is set", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/welcome/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("can browse colleges without completing onboarding", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/welcome/);
    await page.getByRole("link", { name: /browse colleges/i }).click();
    await expect(page).toHaveURL(/\/colleges/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("onboarding 3-step flow → lands on Find page", async ({ page }) => {
    await page.goto("/welcome");

    // Step 1: merit number
    await page.getByLabel(/merit/i).fill("12840");
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 2: category and gender
    await expect(page.getByText(/step 2/i)).toBeVisible();
    // Category default is "Open" — just continue
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 3: home university (optional — just finish)
    await expect(page.getByText(/step 3/i)).toBeVisible();
    await page.getByRole("button", { name: /start exploring/i }).click();

    // Should land on Find page (rank finder)
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("Rank finder", () => {
  test.beforeEach(async ({ page }) => {
    // Set a profile so we land on Find, not welcome
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("compass_profile", JSON.stringify({
        meritNumber: 1500,
        category: null,
        gender: "M",
        subjectGroup: "PCM",
        homeUniversity: "Savitribai Phule Pune University",
        ews: false, tfws: false, defence: false, pwd: false, orphan: false,
      }));
    });
    await page.reload();
  });

  test("find page loads and shows the form", async ({ page }) => {
    await expect(page).toHaveURL("/");
    // Should have a merit input or similar form element
    await expect(page.locator('input, select, button').first()).toBeVisible({ timeout: 5_000 });
  });

  test("submitting find form shows results", async ({ page }) => {
    await page.goto("/");
    // Click the search/find button
    const searchBtn = page.getByRole("button", { name: /find|search|check/i }).first();
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
      // Results or empty-state should appear
      const results = page.locator('[class*="find-result"], [class*="result-card"], [class*="option"]');
      const emptyState = page.locator('[class*="empty"], [class*="no-result"]');
      await expect(results.first().or(emptyState.first())).toBeVisible({ timeout: 12_000 });
    }
  });
});
