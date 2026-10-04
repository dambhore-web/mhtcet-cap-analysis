import { describe, expect, it } from "vitest";
import { signedInOrReturning } from "../src/lib/supabase";

/** A Storage-like list of keys. */
const store = (...keys: string[]) => ({ length: keys.length, key: (i: number) => keys[i] ?? null });
const at = (pathname: string, search = "") => ({ pathname, search });

describe("Supabase loads only when someone is signed in (lib/supabase.ts)", () => {
  it("not for a visitor who never signed in", () => {
    expect(signedInOrReturning(store("gmc-analytics-consent", "compass_profile_v1"), at("/colleges/16006"))).toBe(false);
    expect(signedInOrReturning(store(), at("/signin"))).toBe(false); // the sign-in page before signing in
  });

  it("when this browser holds a saved session", () => {
    expect(signedInOrReturning(store("sb-abcdefgh-auth-token"), at("/"))).toBe(true);
  });

  it("when Google sends the student back to /signin", () => {
    expect(signedInOrReturning(store(), at("/signin", "?code=xyz"))).toBe(true);
    expect(signedInOrReturning(store(), at("/signin", "?error=access_denied"))).toBe(true);
  });

  it("copes with storage that can't be read", () => {
    const blocked = { get length(): number { throw new Error("SecurityError"); }, key: () => null };
    expect(signedInOrReturning(blocked, at("/"))).toBe(false);
    expect(signedInOrReturning(null, at("/"))).toBe(false);
  });
});
