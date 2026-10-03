import { test, expect, seed, topNav } from "./fixtures/test";

/** SEO: each public page has its own title, description and canonical URL; personal pages say noindex. */
const head = (page: import("@playwright/test").Page) =>
  page.evaluate(() => ({
    title: document.title,
    description: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? "",
    canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute("href") ?? "",
    robots: document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content ?? null,
  }));

test.describe("Page titles and search tags", () => {
  test.beforeEach(async ({ page }) => seed(page));

  test("a college page is titled and described from its data, with a clean canonical URL", async ({ page }) => {
    await page.goto("/colleges/16006?from=search");
    await expect(page).toHaveTitle("COEP Technological University — CAP 2026 cutoffs by branch | GetMeCollege");
    const h = await head(page);
    expect(h.description).toMatch(/^Closing merit numbers for \d+ branch(es)? at COEP Technological University/);
    expect(h.canonical).toMatch(/\/colleges\/16006$/);
    expect(h.robots).toBeNull();
  });

  test("a branch page names the branch and the college", async ({ page }) => {
    await page.goto("/colleges/16006/1600601910");
    await expect(page).toHaveTitle(/^Computer Engineering, COEP Technological University — CAP cutoffs/);
  });

  test("personal pages and missing colleges stay out of search", async ({ page }) => {
    for (const path of ["/profile", "/list", "/find", "/colleges/99999"]) {
      await page.goto(path);
      await expect.poll(async () => (await head(page)).robots, { message: path }).toBe("noindex");
    }
  });

  test("moving to a page without noindex clears it again", async ({ page }) => {
    await page.goto("/profile");
    await expect.poll(async () => (await head(page)).robots).toBe("noindex");
    await topNav(page).getByRole("link", { name: "Colleges", exact: true }).click();
    await expect(page).toHaveTitle("Maharashtra engineering colleges — CAP cutoffs | GetMeCollege");
    expect((await head(page)).robots).toBeNull();
  });
});
