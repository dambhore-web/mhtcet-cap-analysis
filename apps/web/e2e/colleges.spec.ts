import { test, expect, seed } from "./fixtures/test";

test.describe("Colleges directory", () => {
  test.beforeEach(async ({ page }) => seed(page));

  test("lists colleges and searches by name", async ({ page }) => {
    await page.goto("/colleges");
    await expect(page.getByRole("link", { name: /COEP Technological University/ })).toBeVisible();
    await page.getByLabel(/search colleges/i).fill("Vishwakarma");
    await expect(page.getByRole("link", { name: /Vishwakarma Institute/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /COEP Technological University/ })).toHaveCount(0);
  });

  test("opens a college page with chart and tables", async ({ page }) => {
    await page.goto("/colleges");
    await page.getByRole("link", { name: /COEP Technological University/ }).click();
    await expect(page).toHaveURL(/\/colleges\/16006/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("COEP");
    await expect(page.getByRole("img", { name: /closing merit/i }).first()).toBeVisible();
    await page.getByText("Show as a table").first().click();
    await expect(page.getByRole("table").first()).toBeVisible();
  });

  test("shows the college's own figures and its NIRF placement, and nothing without data", async ({ page }) => {
    await page.goto("/colleges/16006");
    const card = page.getByRole("region", { name: /placement/i });
    await expect(card).toBeVisible();
    await expect(card).toContainText("College's own figures (2025-26)");
    await expect(card).toContainText("₹44 lakh");
    await expect(card).toContainText("Unverified");
    await expect(card).toContainText("In 2024-25");
    await expect(card).toContainText("₹9 lakh");
    await expect(card.getByRole("row")).toHaveCount(4);
    await expect(card.getByRole("link", { name: /NIRF 2026/ })).toHaveAttribute("href", /demo-nirf-16006/);
    // Only the college's own figures
    await page.goto("/colleges/03012");
    const own = page.getByRole("region", { name: /placement/i });
    await expect(own).toContainText("₹34 lakh");
    await expect(own.getByRole("table")).toHaveCount(0);
    // Neither
    await page.goto("/colleges/06007");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Vishwakarma");
    await expect(page.getByRole("region", { name: /placement/i })).toHaveCount(0);
  });

  test("section links jump within the page and only list sections the college has (#138)", async ({ page }) => {
    await page.goto("/colleges/16006#placement");
    const nav = page.getByRole("navigation", { name: "Sections on this page" });
    await expect(nav.getByRole("link", { name: "Cutoffs" })).toBeVisible();
    const placement = nav.getByRole("link", { name: "Placement" });
    await expect(placement).toHaveAttribute("aria-current", "location");
    await expect(page.getByRole("region", { name: /placement/i })).toBeInViewport();
    // the sticky row never covers the heading it jumped to
    await nav.getByRole("link", { name: "Branches" }).click();
    await expect(page).toHaveURL(/#branches$/);
    const heading = page.getByRole("heading", { name: "One branch, every seat type" });
    await expect(heading).toBeInViewport();
    const navBox = (await nav.boundingBox())!;
    await expect.poll(async () => (await heading.boundingBox())!.y).toBeGreaterThanOrEqual(navBox.y + navBox.height);
    await expect(nav.getByRole("link", { name: "Branches" })).toHaveAttribute("aria-current", "location");
    // a college without placement figures has no Placement link
    await page.goto("/colleges/06007");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Vishwakarma");
    await expect(nav.getByRole("link", { name: "Cutoffs" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Placement" })).toHaveCount(0);
  });

  test("fees: FRA-approved with a source link, and a reason when a college has none (#42)", async ({ page }) => {
    await page.goto("/colleges/06271");
    const fees = page.locator("#fees");
    await expect(fees).toContainText(/FRA-approved, 20\d\d-\d\d/);
    await expect(fees).not.toContainText("Unverified");
    await fees.locator("summary").click();
    await expect(fees.getByRole("link", { name: "FRA report" })).toHaveAttribute("href", /mahafraportal\.org/);
    await expect(fees).toContainText("Confirm with the college before paying");
    // a government college: no number, and why
    await page.goto("/colleges/03012");
    const none = page.getByRole("region", { name: "Fees per year" });
    await expect(none).toContainText("Government college: fees are set by the state or the university");
    await expect(none).not.toContainText(/₹[\d,]{5,}/); // no fee amount (the TFWS line mentions ₹8L)
    await expect(page.getByRole("navigation", { name: "Sections on this page" }).getByRole("link", { name: "Fees" })).toBeVisible();
  });

  test("college page breadcrumb returns to the directory", async ({ page }) => {
    await page.goto("/colleges/16006");
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Colleges" }).click();
    await expect(page).toHaveURL(/\/colleges$/);
  });

  test("unknown college shows a not-found state", async ({ page }) => {
    await page.goto("/colleges/99999");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/not found/i);
  });
});
