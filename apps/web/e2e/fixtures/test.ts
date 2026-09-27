import { test as base, expect, type Page } from "@playwright/test";

export const PROFILE = {
  meritNumber: 5200,
  category: null,
  gender: "M",
  subjectGroup: "PCM",
  homeUniversity: "Savitribai Phule Pune University",
  ews: false,
  tfws: false,
  defence: false,
  pwd: false,
  orphan: false,
};

export const STORAGE = {
  profile: "compass_profile_v1",
  list: "compass_list_v1",
  compare: "compass_compare_v1",
  session: "compass_session_v1",
} as const;

/** Seed localStorage before the app boots. Pass `profile: null` for a first-time visitor. */
export async function seed(page: Page, data: { profile?: object | null; list?: object[]; compare?: object[] } = {}) {
  const profile = data.profile === undefined ? PROFILE : data.profile;
  const id = `__seeded_${Math.random().toString(36).slice(2)}`;
  await page.addInitScript(
    ([keys, p, l, c, flag]) => {
      // seed once per seed() call, so the app's own writes survive later navigations
      if (sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, "1");
      localStorage.clear();
      if (p) localStorage.setItem(keys.profile, JSON.stringify(p));
      if (l) localStorage.setItem(keys.list, JSON.stringify(l));
      if (c) localStorage.setItem(keys.compare, JSON.stringify(c));
    },
    [STORAGE, profile, data.list ?? null, data.compare ?? null, id] as const,
  );
}

/** The top navigation (desktop). */
export function topNav(page: Page) {
  return page.getByRole("navigation", { name: "Main navigation" });
}

export const test = base.extend<{ fontsBlocked: void }>({
  fontsBlocked: [
    async ({ page }, use) => {
      await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
      await use();
    },
    { auto: true },
  ],
});

export { expect };
