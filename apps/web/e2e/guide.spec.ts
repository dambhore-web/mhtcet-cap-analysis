import { test, expect, seed } from "./fixtures/test";

test.describe("CAP guide", () => {
  test.beforeEach(async ({ page }) => seed(page));

  test("opens on How CAP works and switches tabs", async ({ page }) => {
    await page.goto("/guide");
    await expect(page.getByRole("tab", { name: /how cap works/i })).toHaveAttribute("aria-selected", "true");
    for (const name of [/freeze/i, /float/i, /slide/i, /seat codes/i, /faq/i]) {
      await page.getByRole("tab", { name }).click();
      await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
    }
  });

  test("a tab can be linked directly", async ({ page }) => {
    await page.goto("/guide?tab=codes");
    await expect(page.getByRole("tab", { name: /seat codes/i })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("cell", { name: "General open, home university" })).toBeVisible();
  });
});
