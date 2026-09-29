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

  test("shows NIRF placement when the college reported it, and nothing otherwise", async ({ page }) => {
    await page.goto("/colleges/16006");
    const card = page.getByRole("region", { name: /placement/i });
    await expect(card).toBeVisible();
    await expect(card).toContainText("In 2024-25");
    await expect(card).toContainText("₹9 lakh");
    await expect(card.getByRole("row")).toHaveCount(4);
    await expect(card.getByRole("link", { name: /NIRF 2026/ })).toHaveAttribute("href", /demo-nirf-16006/);
    await page.goto("/colleges/03012");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Veermata");
    await expect(page.getByRole("region", { name: /placement/i })).toHaveCount(0);
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
