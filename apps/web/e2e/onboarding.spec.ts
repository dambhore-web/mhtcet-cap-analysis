import { test, expect, seed, PROFILE } from "./fixtures/test";

test.describe("First visit: landing, questions one at a time, scan, results (#142)", () => {
  test.beforeEach(async ({ page }) => seed(page, { profile: null }));

  test("home is the landing page, which shows the real data counts", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Find the colleges and branches");
    await expect(page.getByRole("region", { name: /the data compass checks/i })).toContainText("colleges in CAP");
    await expect(page.getByRole("link", { name: "Computer & IT" })).toHaveAttribute("href", /\/branches\?group=Computer/);
  });

  test("can browse colleges without answering anything", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Browse colleges" }).first().click();
    await expect(page).toHaveURL(/\/colleges/);
    await expect(page.getByRole("heading", { level: 1, name: "Colleges" })).toBeVisible();
  });

  test("every question, then the scan screen, then results filtered to the chosen branches", async ({ page }) => {
    await page.goto("/welcome"); // old address still works
    await expect(page).toHaveURL(/\/$/);
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

    // the answers are tiles above the results; the branches chosen are in the Branches tile
    const branches = page.getByRole("button", { name: /^Branches/ });
    await expect(branches).toHaveText("Computer & IT");
    await branches.click();
    await page.getByRole("button", { name: /show all branches/i }).click();
    await expect(branches).toHaveText("All branches");
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

  test("sees the landing page too, with a link straight to their results", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Find the colleges and branches");
    await expect(page.getByRole("link", { name: /start over/i })).toHaveAttribute("href", "/welcome/start");
    await page.getByRole("link", { name: /continue to my results/i }).click();
    await expect(page).toHaveURL(/\/find\?merit=5200/);
    await expect(page.getByRole("heading", { level: 2, name: /options for merit 5,200/i })).toBeVisible();
  });

  test("old result links (/?merit=…) open Find colleges", async ({ page }) => {
    await page.goto("/?merit=5200");
    await expect(page).toHaveURL(/\/find\?merit=5200/);
    await expect(page.getByRole("heading", { level: 2, name: /options for merit 5,200/i })).toBeVisible();
  });
});

test.describe("Answer tiles on Find colleges (#142)", () => {
  test.beforeEach(async ({ page }) => seed(page, { profile: PROFILE }));

  test("changing an answer searches again and remembers it", async ({ page }) => {
    await page.goto("/find");
    await expect(page.getByRole("heading", { level: 2, name: /options for merit 5,200/i })).toBeVisible();

    await page.getByLabel("Category").selectOption("OBC");
    await expect(page).toHaveURL(/cat=OBC/);
    await expect(page.getByRole("heading", { level: 2, name: /options for merit 5,200/i })).toBeVisible();

    const merit = page.getByRole("textbox", { name: "Merit number" });
    await merit.fill("6,000");
    await expect(page.getByRole("heading", { level: 2, name: /options for merit 6,000/i })).toBeVisible();
    await expect(page).toHaveURL(/merit=6000/);

    // special seats: EWS is only for Open category
    await page.getByRole("button", { name: /^Special seats/ }).click();
    await expect(page.getByRole("checkbox", { name: /EWS/ })).toBeDisabled();
    await page.getByRole("checkbox", { name: /TFWS/ }).check();
    await expect(page).toHaveURL(/tfws=1/);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /^Special seats/ })).toHaveText("TFWS");

    // branches narrow the results and can be cleared again
    await page.getByRole("button", { name: /^Branches/ }).click();
    await page.getByRole("checkbox", { name: "Mechanical" }).check();
    await expect(page).toHaveURL(/bg=Mechanical/);

    // the changed answers are saved to My details
    await page.goto("/profile/details");
    await expect(page.getByLabel("State merit number")).toHaveValue(/6,?000/);
  });

  test("a bad merit number says so and keeps the results", async ({ page }) => {
    await page.goto("/find");
    await expect(page.getByRole("heading", { level: 2, name: /options for merit 5,200/i })).toBeVisible();
    const merit = page.getByRole("textbox", { name: "Merit number" });
    await merit.fill("abc");
    await merit.press("Enter");
    await expect(page.getByRole("alert")).toContainText(/enter a merit number/i);
    await expect(page.getByRole("heading", { level: 2, name: /options for merit 5,200/i })).toBeVisible();
  });

  test("JEE Main shows only the All India answers", async ({ page }) => {
    await page.goto("/find?merit=3000&list=AI");
    await expect(page.getByRole("heading", { level: 2, name: /options for all india merit 3,000/i })).toBeVisible();
    await expect(page.getByLabel("All India merit number")).toHaveValue("3000");
    await expect(page.getByLabel("Category")).toHaveCount(0);
    await expect(page.getByLabel("Home university")).toHaveCount(0);
  });

  test("with no merit number yet, asks for one", async ({ page }) => {
    await seed(page, { profile: { ...PROFILE, meritNumber: null } });
    await page.goto("/find");
    await expect(page.getByRole("heading", { name: /enter your merit number/i })).toBeVisible();
    await page.getByLabel("Merit number").fill("5200");
    await expect(page.getByRole("heading", { level: 2, name: /options for merit 5,200/i })).toBeVisible();
  });

  test("on a phone the answers fold into one line @phone", async ({ page }) => {
    await page.goto("/find");
    await expect(page.getByRole("heading", { level: 2, name: /options for merit 5,200/i })).toBeVisible();
    const toggle = page.getByRole("button", { name: /your answers/i });
    await expect(toggle).toContainText("5,200 · Open · Male");
    await expect(page.getByLabel("Category")).toBeHidden();
    await toggle.click();
    await expect(page.getByLabel("Category")).toBeVisible();
    await page.getByRole("button", { name: /^Branches/ }).click();
    const width = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(width).toBeLessThanOrEqual(0);
  });
});
