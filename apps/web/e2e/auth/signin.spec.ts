import { test, expect, seed, PROFILE } from "../fixtures/test";
import { E2E_USER, mockSupabase, signInWithGoogle } from "../fixtures/supabase";

/**
 * Google sign-in and account sync (#15), against the fake Supabase (#23): the real app code, the
 * real supabase-js client, nothing on the network.
 */
const choice = (college: string, name: string, bi: number, branch: string) => ({
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
const RECENT = () => new Date(Date.now() - 60_000).toISOString();

test("sign in with Google returns to the page you started from, and uploads this browser's details", async ({ page }) => {
  await seed(page);
  const supabase = await mockSupabase(page);
  await page.goto("/colleges");
  await page.getByRole("banner").getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/signin$/);
  await signInWithGoogle(page);
  await expect(page).toHaveURL(/\/colleges$/);
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
  // details saved here before signing in go up to the account, with a real time (not 1970)
  await expect.poll(() => (supabase.rows.get("profile")?.value as { meritNumber?: number } | undefined)?.meritNumber).toBe(5200);
  expect(supabase.rows.get("profile")!.updated_at.startsWith("1970")).toBe(false);
});

test("a newer copy in the account replaces this browser's: details and option form arrive", async ({ page }) => {
  await seed(page);
  await mockSupabase(page, {
    profile: { value: { ...PROFILE, meritNumber: 7300, minorityCommunity: null }, updated_at: RECENT() },
    list: { value: [choice("16006", "COEP Technological University", 0, "Computer Engineering"), choice("06271", "Pune Institute of Computer Technology", 0, "Computer Engineering")], updated_at: RECENT() },
  });
  await page.goto("/signin");
  await signInWithGoogle(page);
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("region", { name: "Your account" })).toContainText(E2E_USER.email);
  await expect(page.getByRole("region", { name: "Your numbers" })).toContainText("7,300");
  await expect(page.getByRole("region", { name: "Your option form", exact: true })).toContainText("2 of 300 choices");
  await expect(page.getByRole("status").filter({ hasText: "Saved to your account" })).toBeVisible();
});

test("changes made while signed in are saved to the account", async ({ page }) => {
  await seed(page);
  const supabase = await mockSupabase(page);
  await page.goto("/signin");
  await signInWithGoogle(page);

  await page.goto("/find");
  await page.getByRole("button", { name: /add .* to your option form/i }).first().click();
  await expect.poll(() => (supabase.rows.get("list")?.value as unknown[] | undefined)?.length).toBe(1);

  await page.goto("/profile/details");
  await page.getByLabel("State merit number").fill("6100");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect.poll(() => (supabase.rows.get("profile")?.value as { meritNumber?: number } | undefined)?.meritNumber).toBe(6100);
});

test("signing out removes the details from this browser and keeps them in the account", async ({ page }) => {
  await seed(page);
  const supabase = await mockSupabase(page, {
    list: { value: [choice("16006", "COEP Technological University", 0, "Computer Engineering")], updated_at: RECENT() },
  });
  await page.goto("/signin");
  await signInWithGoogle(page);
  await expect(page.getByRole("region", { name: "Your option form", exact: true })).toContainText("1 of 300 choices");

  await page.getByRole("region", { name: "Your account" }).getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in to use on other devices" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Your option form", exact: true })).toContainText("No choices yet");
  expect(await page.evaluate(() => localStorage.getItem("compass_list_v1"))).toBeNull();
  expect(supabase.signOuts).toBe(1);
  expect((supabase.rows.get("list")!.value as unknown[]).length).toBe(1);
});

test("deleting saved data empties the account and signs out", async ({ page }) => {
  await seed(page);
  const supabase = await mockSupabase(page);
  await page.goto("/signin");
  await signInWithGoogle(page);
  await expect.poll(() => supabase.rows.size).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Delete data saved to my account" }).click();
  await page.getByRole("button", { name: "Yes, delete my saved data" }).click();
  await expect(page.getByRole("link", { name: "Sign in to use on other devices" })).toBeVisible();
  expect(supabase.rows.size).toBe(0);
  // this browser keeps its copy
  await expect(page.getByRole("region", { name: "Your numbers" })).toContainText("5,200");
});

test("a cancelled Google sign-in says so and offers to carry on", async ({ page }) => {
  await seed(page);
  await mockSupabase(page);
  await page.goto("/signin?error=access_denied&error_description=The+user+denied+access");
  await expect(page.getByRole("alert")).toContainText("Google sign-in didn't finish");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  await expect(page.getByRole("link", { name: "Continue without signing in" })).toBeVisible();
});
