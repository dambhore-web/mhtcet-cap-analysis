import { test, expect, seed, PROFILE } from "./fixtures/test";

/** #135: the "What should I do next?" card follows the student through CAP. */
test.describe("Next step card", () => {
  const card = (page: import("@playwright/test").Page) => page.locator(".next-step");
  const title = (page: import("@playwright/test").Page) => page.locator("#next-step-title");

  test("without a merit number it points to the estimate", async ({ page }) => {
    await seed(page, { profile: { ...PROFILE, meritNumber: null } });
    await page.goto("/find");
    await expect(title(page)).toHaveText("Estimate where you stand");
    await card(page).getByRole("button", { name: "Estimate from your percentile" }).click();
    await expect(page).toHaveURL(/\/estimate$/);
  });

  test("walks add choices → test the list → export → allotment → family summary", async ({ page }) => {
    await seed(page);
    await page.goto("/find");
    await expect(title(page)).toHaveText("Add choices to your option form");

    await page.getByRole("button", { name: /add .* to your option form/i }).first().click();
    await expect(title(page)).toHaveText("Test your list in the simulator");
    await card(page).getByRole("button", { name: "Test your list" }).click();
    await expect(page).toHaveURL(/\/simulator$/);
    await page.getByRole("button", { name: "Run simulation" }).click();
    await expect(page.getByRole("button", { name: "Run again" })).toBeVisible();

    await page.goto("/find");
    await expect(title(page)).toHaveText("Export for the CAP portal");
    await page.goto("/export");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download CSV" }).click();
    await download;

    await page.goto("/find");
    await expect(title(page)).toHaveText("When your allotment comes out");

    // the allotted seat is the one choice on the form
    await page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem("compass_list_v1") ?? "[]");
      localStorage.setItem("compass_allotment_v1", JSON.stringify({ round: "II", choiceCode: list[0].choiceCode }));
    });
    await page.reload();
    await expect(title(page)).toHaveText("Freeze, float or slide?");
    await card(page).getByRole("button", { name: "Decide on your seat" }).click();
    await expect(page).toHaveURL(/\/allotment$/);
    await page.getByRole("button", { name: /I've made my choice/ }).click();
    await expect(page.getByRole("button", { name: /Choice made/ })).toHaveAttribute("aria-pressed", "true");

    await page.goto("/find");
    await expect(title(page)).toHaveText("Share the family summary");
  });

  test("can be hidden for the session", async ({ page }) => {
    await seed(page);
    await page.goto("/find");
    await expect(title(page)).toBeVisible();
    await page.getByRole("button", { name: "Hide the next step for now" }).click();
    await expect(title(page)).toHaveCount(0);
    await page.reload();
    await expect(title(page)).toHaveCount(0);
  });
});
