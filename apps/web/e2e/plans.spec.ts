import { test, expect, seed } from "./fixtures/test";

/** Payments are deferred until there is traffic (docs/DECISIONS.md, 2026-10-02): no plans, prices or upgrade prompts. */
test.describe("No paid plans", () => {
  test.beforeEach(async ({ page }) => seed(page));

  test("no Plans link anywhere, and /plans goes home", async ({ page }) => {
    for (const path of ["/", "/find", "/profile", "/ask"]) {
      await page.goto(path);
      await expect(page.getByRole("link", { name: /^(Plans|See plans)$/ })).toHaveCount(0);
      await expect(page.getByText(/Season Pass|Unlimited with|₹\s?299/)).toHaveCount(0);
    }
    await page.goto("/plans");
    await expect(page).toHaveURL(/\/$/);
  });

  test("the Terms say Compass is free", async ({ page }) => {
    await page.goto("/legal?tab=terms");
    await expect(page.getByRole("heading", { name: "3. Price" })).toBeVisible();
    await expect(page.getByText(/free to use, and we do not take payments/)).toBeVisible();
    await expect(page.getByText(/Razorpay|refund/i)).toHaveCount(0);
  });
});
