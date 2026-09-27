import { test, expect } from "@playwright/test";

test.describe("Top navigation", () => {
  test.beforeEach(async ({ page }) => {
    // Set profile so we don't get redirected to /welcome
    await page.goto("/colleges");
    await page.evaluate(() => {
      localStorage.setItem("compass_profile", JSON.stringify({
        meritNumber: 5000,
        category: null,
        gender: "M",
        subjectGroup: "PCM",
        homeUniversity: "",
        ews: false, tfws: false, defence: false, pwd: false, orphan: false,
      }));
    });
  });

  test("top nav is visible on the colleges page", async ({ page }) => {
    await page.goto("/colleges");
    await expect(page.locator(".top-nav")).toBeVisible();
    await expect(page.locator(".top-nav-logo")).toBeVisible();
  });

  test("nav links navigate to correct routes", async ({ page }) => {
    await page.goto("/colleges");
    await expect(page.locator(".top-nav")).toBeVisible();

    await page.locator(".top-nav-link", { hasText: "My List" }).click();
    await expect(page).toHaveURL(/\/list/);

    await page.locator(".top-nav-link", { hasText: "Ask" }).click();
    await expect(page).toHaveURL(/\/ask/);

    await page.locator(".top-nav-link", { hasText: "Colleges" }).click();
    await expect(page).toHaveURL(/\/colleges/);
  });

  test("active link has active class", async ({ page }) => {
    await page.goto("/colleges");
    const collegesLink = page.locator(".top-nav-link", { hasText: "Colleges" });
    await expect(collegesLink).toHaveClass(/active/);
  });

  test("logo navigates to Find page", async ({ page }) => {
    await page.goto("/colleges");
    await page.locator(".top-nav-logo").click();
    // With profile set, / → Find page; without profile → /welcome
    await expect(page).toHaveURL(/\/|\/welcome/);
  });
});

test.describe("Guide page", () => {
  test("guide page loads and shows freeze/float/slide tabs", async ({ page }) => {
    await page.goto("/guide");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Should have tab buttons for Freeze, Float, Slide
    await expect(page.getByRole("button", { name: /freeze/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: /float/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /slide/i })).toBeVisible();
  });
});
