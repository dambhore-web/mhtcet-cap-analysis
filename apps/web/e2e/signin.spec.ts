import { test, expect, seed } from "./fixtures/test";

/** #15: builds without Supabase settings (CI, demo) keep everything in the browser and say so. */
test.describe("Sign-in without account settings", () => {
  test.beforeEach(async ({ page }) => seed(page));

  test("the sign-in page says accounts are coming soon and lets the student carry on", async ({ page }) => {
    await page.goto("/signin");
    await expect(page.getByRole("heading", { level: 1, name: "Sign in to Compass" })).toBeVisible();
    await expect(page.getByText("Coming soon")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
    await page.getByRole("link", { name: "Continue without signing in" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("My details offers sign-in as coming soon, and the details stay put", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByRole("link", { name: "Sign in (coming soon)" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Your account" })).toHaveCount(0);
  });
});
