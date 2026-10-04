import { describe, expect, it } from "vitest";
import { analyticsEnabledAt, pageLocation, safeReferrer } from "../src/lib/analytics";

const SITE = "https://getmecollege.com";

describe("Google Analytics (privacy)", () => {
  it("runs only on the public address", () => {
    expect(analyticsEnabledAt(SITE, "https://getmecollege.com")).toBe(true);
    expect(analyticsEnabledAt(SITE + "/", "https://getmecollege.com")).toBe(true);
    expect(analyticsEnabledAt(SITE, "https://mhtcetweb-production.up.railway.app")).toBe(false);
    expect(analyticsEnabledAt(SITE, "http://localhost:3000")).toBe(false);
    expect(analyticsEnabledAt(undefined, "https://getmecollege.com")).toBe(false);
    expect(analyticsEnabledAt("", "https://getmecollege.com")).toBe(false);
    expect(analyticsEnabledAt("not a url", "https://getmecollege.com")).toBe(false);
  });

  it("sends the page path without the query string, which can hold a student's details", () => {
    expect(pageLocation(SITE, "/find")).toBe("https://getmecollege.com/find");
  });

  it("strips the query string from a same-site referrer, and keeps other referrers", () => {
    expect(safeReferrer("https://getmecollege.com/find?merit=1234&cat=OBC&gen=F", SITE)).toBe("https://getmecollege.com/find");
    expect(safeReferrer("https://www.google.com/", SITE)).toBe("https://www.google.com/");
    expect(safeReferrer("", SITE)).toBe("");
    expect(safeReferrer("garbage", SITE)).toBe("");
  });
});
