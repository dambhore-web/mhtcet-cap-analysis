import { test, expect, seed } from "./fixtures/test";

test.describe("First visit", () => {
  test.beforeEach(async ({ page }) => seed(page, { profile: null }));

  test("home redirects to onboarding", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/welcome/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("can browse colleges without onboarding", async ({ page }) => {
    await page.goto("/welcome");
    await page.getByRole("link", { name: /browse colleges/i }).click();
    await expect(page).toHaveURL(/\/colleges/);
    await expect(page.getByRole("heading", { level: 1, name: "Colleges" })).toBeVisible();
  });

  test("three steps land on Find with the merit number filled in", async ({ page }) => {
    await page.goto("/welcome");
    await page.getByLabel(/state merit number/i).fill("5200");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText(/step 2 of 3/i)).toBeVisible();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText(/step 3 of 3/i)).toBeVisible();
    await page.getByRole("button", { name: /see my options/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByLabel(/your state merit number/i)).toHaveValue("5200");
  });

  test("merit number can be skipped", async ({ page }) => {
    await page.goto("/welcome");
    await page.getByRole("button", { name: /skip and add it later/i }).click();
    await expect(page.getByText(/step 2 of 3/i)).toBeVisible();
  });

  test("invalid merit number shows an error", async ({ page }) => {
    await page.goto("/welcome");
    await page.getByLabel(/state merit number/i).fill("abc");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByRole("alert")).toContainText(/valid merit number/i);
  });
});
