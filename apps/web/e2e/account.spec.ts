import { test, expect, seed, PROFILE } from "./fixtures/test";

/** #139: My account shows where the student left off. */
const item = (college: string, name: string, bi: number, branch: string) => ({
  id: `${college}-${bi}`,
  choiceCode: `${college}${String(bi + 1).padStart(2, "0")}910`,
  collegeCode: college,
  collegeName: name,
  branch,
  seatType: "GOPENS",
  closingMerit: 9000,
  year: 2026,
  firstRoundClosing: 8000,
  lastRoundClosing: 9000,
});
const FORM = [
  item("16006", "COEP Technological University", 0, "Computer Engineering"),
  item("06007", "Vishwakarma Institute of Technology", 0, "Computer Engineering"),
  item("06271", "Pune Institute of Computer Technology", 0, "Computer Engineering"),
  item("03012", "Veermata Jijabai Technological Institute", 3, "Mechanical Engineering"),
  item("06271", "Pune Institute of Computer Technology", 3, "Mechanical Engineering"),
  item("06007", "Vishwakarma Institute of Technology", 3, "Mechanical Engineering"),
];

test.describe("My account", () => {
  test("shows your numbers, the next step and the top of the option form", async ({ page }) => {
    await seed(page, { list: FORM });
    await page.goto("/profile");
    await expect(page.getByRole("heading", { level: 1, name: "My account" })).toBeVisible();
    await expect(page.getByText("Saved on this device only.")).toBeVisible();

    const numbers = page.getByRole("region", { name: "Your numbers" });
    await expect(numbers).toContainText("5,200");
    await expect(numbers).toContainText("Savitribai Phule Pune University");
    await expect(numbers).toContainText(/\d+ you can take/);

    await expect(page.locator("#next-step-title")).toHaveText("Test your list in the simulator");

    const form = page.getByRole("region", { name: "Your option form" });
    await expect(form).toContainText("6 of 300 choices");
    await expect(form.getByRole("listitem")).toHaveCount(5);
    await expect(form).toContainText("and 1 more");
    await form.getByRole("link", { name: "Option form" }).click();
    await expect(page).toHaveURL(/\/list$/);
  });

  test("with nothing saved, points to the estimate and Find colleges", async ({ page }) => {
    await seed(page, { profile: { ...PROFILE, meritNumber: null } });
    await page.goto("/profile");
    await expect(page.getByRole("region", { name: "Your numbers" })).toContainText("No merit number yet");
    await expect(page.getByRole("region", { name: "Your option form" })).toContainText("No choices yet");
    // no CAP dates are published yet: no timeline, never a guessed date
    await expect(page.getByRole("region", { name: /CAP \d{4} dates/ })).toHaveCount(0);
  });

  test("Edit details opens the form, which links back", async ({ page }) => {
    await seed(page);
    await page.goto("/profile");
    await page.getByRole("link", { name: "Edit details" }).click();
    await expect(page).toHaveURL(/\/profile\/details$/);
    await expect(page.getByLabel("State merit number")).toHaveValue(/5,?200/);
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "My account" }).click();
    await expect(page).toHaveURL(/\/profile$/);
  });
});
