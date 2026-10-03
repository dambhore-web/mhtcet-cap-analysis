import type { Page } from "@playwright/test";

/**
 * A stand-in for Supabase in the browser (#15, #23): Google sign-in (authorize → redirect back with a
 * code → PKCE token exchange), the user's own user_store rows with the database's newest-wins rule,
 * delete and sign-out. Nothing leaves the test browser.
 */
export const SUPABASE_E2E_URL = "https://compass-e2e.supabase.co";
export const E2E_USER = {
  id: "0b6c4f0e-5d2a-4c39-9a4e-2f1d7c3e8a11",
  email: "student@example.com",
  name: "Test Student",
};

export interface StoredRow {
  value: unknown;
  updated_at: string;
}

export interface FakeSupabase {
  /** The account's copies, by key (profile, list, ...). */
  rows: Map<string, StoredRow>;
  /** Number of sign-outs the app sent. */
  signOuts: number;
}

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

function session() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = {
    id: E2E_USER.id,
    email: E2E_USER.email,
    aud: "authenticated",
    role: "authenticated",
    user_metadata: { full_name: E2E_USER.name },
    app_metadata: { provider: "google" },
  };
  return {
    access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, role: "authenticated", exp, email: user.email })}.e2e`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    refresh_token: "e2e-refresh",
    user,
  };
}

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  headers: { "access-control-allow-origin": "*" },
  body: JSON.stringify(body),
});

export async function mockSupabase(page: Page, initial: Record<string, StoredRow> = {}): Promise<FakeSupabase> {
  const fake: FakeSupabase = { rows: new Map(Object.entries(initial)), signOuts: 0 };

  await page.route(`${SUPABASE_E2E_URL}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;

    // Google sign-in: Supabase would send the student to Google and back; skip straight to "back"
    if (path === "/auth/v1/authorize") {
      const back = new URL(url.searchParams.get("redirect_to") ?? "/");
      back.searchParams.set("code", "e2e-code");
      return route.fulfill({ status: 302, headers: { location: back.toString() } });
    }
    if (path === "/auth/v1/token") return route.fulfill(json(session()));
    if (path === "/auth/v1/logout") {
      fake.signOuts++;
      return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
    }
    if (path === "/auth/v1/user") return route.fulfill(json(session().user));

    if (path === "/rest/v1/user_store" && req.method() === "GET") {
      return route.fulfill(json([...fake.rows].map(([key, r]) => ({ key, value: r.value, updated_at: r.updated_at }))));
    }
    if (path === "/rest/v1/user_store" && req.method() === "DELETE") {
      fake.rows.clear();
      return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
    }
    if (path === "/rest/v1/rpc/put_user_item") {
      const { p_key, p_value, p_updated_at } = req.postDataJSON() as { p_key: string; p_value: unknown; p_updated_at: string };
      const current = fake.rows.get(p_key);
      // the database keeps the newer copy (put_user_item)
      if (!current || Date.parse(current.updated_at) < Date.parse(p_updated_at)) fake.rows.set(p_key, { value: p_value, updated_at: p_updated_at });
      return route.fulfill(json({ key: p_key }));
    }
    return route.fulfill(json({}));
  });

  return fake;
}

/** Sign in through the app's own button and wait until Google "sends the student back". */
export async function signInWithGoogle(page: Page) {
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/signin"));
}
