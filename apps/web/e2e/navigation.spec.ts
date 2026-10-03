import { test, expect, seed, topNav } from "./fixtures/test";

/** Rules from docs/02-architecture/navigation.md. */
const PLACES = [
  { label: "Find colleges", path: "/find" },
  { label: "By branch", path: "/branches" },
  { label: "Colleges", path: "/colleges" },
  { label: "My CAP plan", path: "/list" },
  { label: "Ask GetMeCollege", path: "/ask" },
  { label: "CAP guide", path: "/guide" },
];

test.describe("Top navigation", () => {
  test.beforeEach(async ({ page }) => seed(page));

  test("has the six places in order", async ({ page }) => {
    await page.goto("/colleges");
    const links = topNav(page).getByRole("link");
    await expect(links).toHaveText(PLACES.map((p) => p.label));
  });

  for (const place of PLACES) {
    test(`"${place.label}" opens ${place.path} and is marked current`, async ({ page }) => {
      await page.goto("/guide?tab=faq");
      await topNav(page).getByRole("link", { name: place.label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${place.path.replace("/", "\\/")}(\\?|$)`));
      await expect(topNav(page).getByRole("link", { name: place.label, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }

  test("sub-pages mark their parent place as current", async ({ page }) => {
    const cases: [string, string][] = [
      ["/estimate", "Find colleges"],
      ["/colleges/16006", "Colleges"],
      ["/compare", "Colleges"],
      ["/simulator", "My CAP plan"],
      ["/export", "My CAP plan"],
      ["/allotment", "My CAP plan"],
    ];
    for (const [path, place] of cases) {
      await page.goto(path);
      await expect(topNav(page).getByRole("link", { name: place, exact: true }), path).toHaveAttribute("aria-current", "page");
    }
  });

  test("logo goes home", async ({ page }) => {
    await page.goto("/colleges");
    await page.getByRole("link", { name: /getmecollege home/i }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("shortlist counter shows the option form size and opens it", async ({ page }) => {
    await seed(page, {
      list: [
        { id: "a", choiceCode: "1600601910", collegeCode: "16006", collegeName: "COEP Technological University", branch: "Computer Engineering", seatType: "GOPENS", closingMerit: 600, year: 2026 },
        { id: "b", choiceCode: "0600701910", collegeCode: "06007", collegeName: "Vishwakarma Institute of Technology", branch: "Computer Engineering", seatType: "GOPENS", closingMerit: 10200, year: 2026 },
      ],
    });
    await page.goto("/colleges");
    const counter = page.getByRole("link", { name: /option form: 2 choices/i });
    await expect(counter).toBeVisible();
    await counter.click();
    await expect(page).toHaveURL(/\/list$/);
  });
});

test.describe("My CAP plan steps", () => {
  test.beforeEach(async ({ page }) => seed(page));

  test("shows the five steps and marks the current one", async ({ page }) => {
    await page.goto("/list");
    const steps = page.getByRole("navigation", { name: /my cap plan steps/i }).getByRole("link");
    await expect(steps).toHaveText([/option form/i, /simulator/i, /export/i, /after allotment/i, /family summary/i]);
    for (const [path, name] of [["/simulator", /simulator/i], ["/export", /export/i], ["/allotment", /after allotment/i], ["/summary", /family summary/i]] as const) {
      await page.goto(path);
      await expect(page.getByRole("navigation", { name: /my cap plan steps/i }).getByRole("link", { name })).toHaveAttribute("aria-current", "page");
    }
  });
});

test.describe("Phone menu @phone", () => {
  test.beforeEach(async ({ page }) => seed(page));

  test("burger opens every place", async ({ page }) => {
    await page.goto("/colleges");
    await page.getByRole("button", { name: /menu/i }).click();
    const menu = page.getByRole("navigation", { name: /menu/i });
    for (const p of PLACES) await expect(menu.getByRole("link", { name: p.label, exact: true })).toBeVisible();
    await menu.getByRole("link", { name: "CAP guide", exact: true }).click();
    await expect(page).toHaveURL(/\/guide/);
  });

  test("no page scrolls sideways", async ({ page }) => {
    for (const path of [
      "/", "/?merit=5200", "/colleges", "/colleges/16006", "/colleges/16006/1600601910", "/compare", "/branches",
      "/list", "/list/add", "/simulator", "/export", "/allotment", "/summary",
      "/ask", "/guide", "/guide?tab=codes", "/estimate", "/eligibility", "/data", "/profile", "/profile/details", "/legal", "/signin",
    ]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
