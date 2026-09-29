import { test, expect, seed, PROFILE } from "./fixtures/test";

test.describe("First visit: landing, questions one at a time, scan, results (#142)", () => {
  test.beforeEach(async ({ page }) => seed(page, { profile: null }));

  test("home redirects to the landing page, which shows the real data counts", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Find the colleges and branches");
    await expect(page.getByRole("region", { name: /the data compass checks/i })).toContainText("colleges in CAP");
    await expect(page.getByRole("link", { name: "Computer & IT" })).toHaveAttribute("href", /\/branches\?group=Computer/);
  });

  test("can browse colleges without answering anything", async ({ page }) => {
    await page.goto("/welcome");
    await page.getByRole("link", { name: "Browse colleges" }).first().click();
    await expect(page).toHaveURL(/\/colleges/);
    await expect(page.getByRole("heading", { level: 1, name: "Colleges" })).toBeVisible();
  });

  test("every question, then the scan screen, then results filtered to the chosen branches", async ({ page }) => {
    await page.goto("/welcome");
    await page.getByRole("link", { name: /find my colleges/i }).click();
    await expect(page).toHaveURL(/\/welcome\/start$/);

    await expect(page.getByText("Step 1 of 9")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click(); // MHT-CET (default)
    await page.getByRole("button", { name: "Continue" }).click(); // merit number (default)

    // an invalid merit number is caught on its own screen
    await page.getByLabel("State merit number").fill("abc");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("alert")).toContainText(/state merit number/i);
    await page.getByLabel("State merit number").fill("5,200");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: /which category/i })).toBeVisible();
    await page.getByText("Other Backward Class").click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByText("Female", { exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Step 6 of 9 · optional")).toBeVisible();
    await page.getByRole("button", { name: "Skip" }).click(); // home university

    // EWS is only for Open category
    await expect(page.getByLabel(/EWS/)).toBeDisabled();
    await page.getByText("TFWS").click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: /minority community/i })).toBeVisible();
    await page.getByText("Jain", { exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Step 9 of 9 · optional")).toBeVisible();
    await page.getByText("Computer & IT").click();
    await expect(page.getByText(/Merit number 5,200 · OBC · Female/)).toBeVisible();
    await page.getByRole("button", { name: /show my colleges/i }).click();

    // the scan screen names the real work, then gives way to the results
    await expect(page.getByRole("heading", { name: /checking the cap lists/i })).toBeVisible();
    await expect(page.getByRole("progressbar")).toBeVisible();
    await expect(page.getByText(/Matched the seats you can take/)).toBeVisible();
    await expect(page.getByRole("heading", { name: /options for merit/i })).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL(/scan=1/);
    await expect(page).toHaveURL(/min=Jain/);

    const filter = page.getByLabel("Branch filter");
    await expect(filter).toContainText("Computer & IT");
    await filter.getByRole("button", { name: /show all branches/i }).click();
    await expect(page.getByLabel("Branch filter")).toHaveCount(0);
    await expect(page).not.toHaveURL(/bg=/);
  });

  test("a percentile gives an estimated range and estimated results", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/welcome/start");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByText("Only my MHT-CET percentile").click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Percentile").fill("95");
    await expect(page.getByText(/estimated\s+merit number/i)).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Step 4 of 9")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click(); // category: Open
    await expect(page.getByText("Step 5 of 9")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click(); // gender: Male
    await page.getByRole("button", { name: "Skip" }).click();
    await page.getByRole("button", { name: "None of these" }).click();
    await page.getByRole("button", { name: "Skip" }).click();
    await page.getByRole("button", { name: "No preference" }).click();
    await expect(page.getByRole("heading", { name: /options for merit ≈/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Estimated", { exact: true })).toBeVisible();
  });

  test("JEE skips the state-quota questions @phone", async ({ page }) => {
    await page.goto("/welcome/start");
    await page.getByText("JEE Main").click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Step 2 of 4")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("All India merit number")).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(width).toBeLessThanOrEqual(0);
  });
});

test.describe("Returning visitor", () => {
  test.beforeEach(async ({ page }) => seed(page, { profile: PROFILE }));

  test("skips the landing page and can start over from it", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/welcome/);
    await page.goto("/welcome");
    await expect(page.getByRole("link", { name: /continue to my results/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /start over/i })).toHaveAttribute("href", "/welcome/start");
  });
});
