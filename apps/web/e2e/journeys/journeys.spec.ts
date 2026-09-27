import { test, expect, seed, topNav, PROFILE } from "../fixtures/test";

/**
 * The 14 user journeys in docs/02-architecture/navigation.md, walked on the demo dataset.
 * A journey counts as done only when its spec passes. J14 (payments) is blocked on #15/#21/#34.
 */

const choice = (college: string, branchIndex: number) => `${college}${String(branchIndex + 1).padStart(2, "0")}910`;
const listItem = (college: string, name: string, bi: number, branch: string, first: number, last: number) => ({
  id: `${college}-${bi}`,
  choiceCode: choice(college, bi),
  collegeCode: college,
  collegeName: name,
  branch,
  seatType: "GOPENS",
  closingMerit: last,
  year: 2026,
  firstRoundClosing: first,
  lastRoundClosing: last,
});
const FORM = [
  listItem("16006", "COEP Technological University", 0, "Computer Engineering", 600, 1740),
  listItem("03012", "Veermata Jijabai Technological Institute", 3, "Mechanical Engineering", 11200, 12340),
  listItem("06007", "Vishwakarma Institute of Technology", 0, "Computer Engineering", 10200, 11340),
  listItem("06271", "Pune Institute of Computer Technology", 3, "Mechanical Engineering", 8000, 9140),
];

test("J1 · Which colleges could I get with my merit number?", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await page.getByRole("button", { name: /find my options/i }).click();
  await expect(page.getByRole("heading", { level: 2, name: /options for merit 5,200/i })).toBeVisible();
  await expect(page.getByText(/options within reach, in \d+ colleges/)).toBeVisible();
  // what-if slider re-marks results
  const slider = page.getByLabel(/what if my merit were/i);
  await slider.focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("button", { name: /back to 5,200/i })).toBeVisible();
  await page.getByRole("button", { name: /back to 5,200/i }).click();
  await page.getByRole("link", { name: "Pune Institute of Computer Technology" }).first().click();
  await expect(page).toHaveURL(/\/colleges\/06271$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pune Institute of Computer Technology");
});

test("J2 · I only have my percentile", async ({ page }) => {
  await seed(page, { profile: { ...PROFILE, meritNumber: null } });
  await page.goto("/");
  await page.getByRole("link", { name: /estimate it from your percentile/i }).click();
  await expect(page).toHaveURL(/\/estimate/);
  await page.getByLabel("MHT-CET percentile").fill("96.5");
  await page.getByRole("button", { name: "Estimate" }).click();
  await expect(page.getByRole("heading", { name: /likely state merit number/i })).toBeVisible();
  await page.getByRole("button", { name: /find options for/i }).click();
  await expect(page.getByRole("note")).toContainText(/estimated from your percentile/i);
});

test("J3 · Where can I study Computer Engineering?", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await topNav(page).getByRole("link", { name: "By branch" }).click();
  await page.getByRole("button", { name: "Computer & IT" }).click();
  await expect(page.getByRole("heading", { level: 2, name: /computer & it: \d+ colleges/i })).toBeVisible();
  await page.getByRole("button", { name: /add computer engineering at pune institute/i }).click();
  await expect(page.getByRole("link", { name: /option form: 1 choice/i })).toBeVisible();
  await page.getByRole("link", { name: "Pune Institute of Computer Technology" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pune Institute");
});

test("J4 · What were the cutoffs at COEP?", async ({ page }) => {
  await seed(page);
  await page.goto("/colleges");
  await page.getByRole("link", { name: /COEP Technological University/ }).click();
  await page.getByText("Show as a table").first().click();
  await expect(page.getByRole("columnheader", { name: "Round IV" }).first()).toBeVisible();
  await page.getByRole("link", { name: "Branch trends" }).click();
  await expect(page).toHaveURL(/\/colleges\/16006\/1600601910/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Computer Engineering at COEP");
  await expect(page.getByRole("heading", { name: "Earlier years" })).toBeVisible();
});

test("J5 · Is COEP or VIT better for me?", async ({ page }) => {
  await seed(page);
  for (const code of ["16006", "06007"]) {
    await page.goto(`/colleges/${code}`);
    await page.getByRole("button", { name: "Add to compare" }).click();
  }
  await page.goto("/compare");
  await expect(page.getByRole("heading", { name: /your line across all 2/i })).toBeVisible();
  await expect(page.getByText(/best for you:/i).first()).toBeVisible();
  await expect(page.getByText(/a year/).first()).toBeVisible(); // COEP fee
});

test("J6 · Do TFWS, EWS or Defence seats help me?", async ({ page }) => {
  await seed(page);
  await page.goto("/guide?tab=codes");
  await page.getByRole("link", { name: /check which seats you can apply for/i }).click();
  await expect(page).toHaveURL(/\/eligibility/);
  await page.getByLabel(/tuition fee waiver/i).check();
  await expect(page.getByText(/reached \d+ branches last year/)).toBeVisible();
  await page.getByRole("button", { name: /save and update my results/i }).click();
  await expect(page.getByRole("heading", { level: 2, name: /options for merit/i })).toBeVisible();
  await expect(page.getByText("TFWS", { exact: true })).toBeVisible();
});

test("J7 · I applied through JEE Main", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await page.getByRole("button", { name: "JEE percentile" }).click();
  await page.getByLabel("JEE Main percentile").fill("97");
  await expect(page.getByText(/≈ All India merit/)).toBeVisible();
  await page.getByRole("button", { name: /find my options/i }).click();
  await expect(page.getByRole("heading", { level: 2, name: /options for all india merit/i })).toBeVisible();
  await expect(page.getByText(/All India seats, from last year/)).toBeVisible();
});

test("J8 · In what order should I fill my option form?", async ({ page }) => {
  await seed(page);
  await page.goto("/?merit=5200");
  await page.getByRole("button", { name: /add .* to your option form/i }).first().click();
  await topNav(page).getByRole("link", { name: "My CAP plan" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /your cap option form/i })).toBeVisible();
  await expect(page.getByText(/auto-freeze zone from round i/i)).toBeAttached();
  await page.getByRole("link", { name: /add options from any college/i }).first().click();
  await page.getByLabel(/search colleges, branches or choice codes/i).fill("Mechanical");
  await page.getByRole("button", { name: /add mechanical engineering at coep/i }).click();
  await page.getByRole("link", { name: /done/i }).click();
  await expect(page.getByRole("list", { name: /choices in order/i }).getByRole("listitem")).toHaveCount(2);
  await page.getByRole("navigation", { name: /my cap plan steps/i }).getByRole("link", { name: /export/i }).click();
  await expect(page.getByRole("table")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Excel" }).click();
  expect((await download).suggestedFilename()).toBe("compass-option-form.xlsx");
});

test("J9 · Where would this list actually land me?", async ({ page }) => {
  await seed(page, { list: FORM });
  await page.goto("/list");
  await page.getByRole("navigation", { name: /my cap plan steps/i }).getByRole("link", { name: /simulator/i }).click();
  await page.getByRole("button", { name: /run simulation/i }).click();
  await expect(page.getByText(/with this list you would have/i)).toBeVisible();
  await expect(page.getByRole("list", { name: /round by round/i }).getByRole("listitem")).toHaveCount(4);
  await expect(page.getByRole("heading", { name: /your list, round by round/i })).toBeVisible();
});

test("J10 · I got a seat. Freeze or float?", async ({ page }) => {
  await seed(page, { list: FORM });
  await page.goto("/allotment");
  await page.getByLabel("Seat you were allotted").selectOption(FORM[3].choiceCode);
  await expect(page.getByRole("heading", { level: 2, name: /float is worth considering|freeze looks right|slide/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /choices above your seat/i })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "family summary", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Family summary" })).toBeVisible();
  await expect(page.getByText(/in round i \(choice 4\)/i)).toBeVisible();
});

test("J11 · What exactly is our plan? (parent, shared link)", async ({ page, browser }) => {
  await seed(page, { list: FORM });
  await page.goto("/summary");
  const href = await page.getByRole("link", { name: /share on whatsapp/i }).getAttribute("href");
  const shared = decodeURIComponent(href!.split("text=")[1]).match(/https?:\/\/\S+/)![0];
  const parent = await (await browser.newContext({ serviceWorkers: "block" })).newPage();
  await parent.goto(shared.replace(/^https?:\/\/[^/]+/, "http://localhost:5173"));
  await expect(parent.getByText(/a cap plan shared with you/i)).toBeVisible();
  await expect(parent.getByText("COEP Technological University")).toBeVisible();
});

test("J12 · How does CAP work? What is GOPENS?", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await topNav(page).getByRole("link", { name: "CAP guide" }).click();
  await page.getByRole("tab", { name: /seat codes/i }).click();
  await expect(page.getByRole("cell", { name: "General open, state level" })).toBeVisible();
  await topNav(page).getByRole("link", { name: "Ask Compass" }).click();
  await page.getByLabel("Your question").fill("What were the cutoffs at COEP?");
  await page.getByRole("button", { name: /send question/i }).click();
  await expect(page.getByText(/1 source|\d+ sources/).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("link", { name: /source S1/i }).first()).toBeVisible();
});

test("J13 · Can I trust these numbers?", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await page.getByRole("link", { name: /where our numbers come from/i }).click();
  await expect(page.getByRole("heading", { level: 1, name: /where our numbers come from/i })).toBeVisible();
  await expect(page.getByText("Cutoff values")).toBeVisible();
  await expect(page.getByRole("cell", { name: /demo-cutoff-list-round-I-MH\.pdf/ }).first()).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "disclaimer", exact: true }).click();
  await expect(page).toHaveURL(/\/legal/);
});
