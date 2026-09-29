import { test, expect, seed } from "./fixtures/test";

/**
 * Smoke test against the real API and the staging Supabase data.
 * Runs only when E2E_LIVE=1 (CI sets it when DATABASE_URL_STAGING is available);
 * see the "live" project in playwright.config.ts.
 */
test.describe("Live data smoke @live", () => {
  test.skip(!process.env.E2E_LIVE, "set E2E_LIVE=1 with DATABASE_URL_STAGING to run against staging data");

  test("API reports the loaded dataset", async ({ request }) => {
    const res = await request.get("http://localhost:3001/api/colleges?q=&limit=400");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.total).toBeGreaterThan(300);
  });

  test("COEP page shows Computer Engineering from the official lists", async ({ page }) => {
    await seed(page);
    await page.goto("/colleges/16006");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/COEP/i);
    await expect(page.getByText(/computer/i).first()).toBeVisible();
  });

  test("rank finder returns options for a mid-range merit number", async ({ page }) => {
    await seed(page, { profile: { meritNumber: 12000, category: null, gender: "M", subjectGroup: "PCM", homeUniversity: "", ews: false, tfws: false, defence: false, pwd: false, orphan: false } });
    await page.goto("/find?merit=12000");
    await expect(page.getByRole("heading", { level: 2, name: /options for merit 12,000/i })).toBeVisible({ timeout: 20_000 });
  });
});
