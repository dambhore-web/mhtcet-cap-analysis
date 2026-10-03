import { describe, expect, it } from "vitest";
import { BRANCH_GROUP_BY_SLUG, slugify } from "../src/slugs.ts";

describe("slugs for landing pages (SEO)", () => {
  it("turns district names into URL slugs", () => {
    expect(slugify("Pune")).toBe("pune");
    expect(slugify("Mumbai-Suburban")).toBe("mumbai-suburban");
    expect(slugify("Chhatrapati Sambhaji Nagar")).toBe("chhatrapati-sambhaji-nagar");
    expect(slugify("  Ahilyanagar  ")).toBe("ahilyanagar");
  });

  it("turns branch groups into slugs and back", () => {
    expect(slugify("Computer & IT")).toBe("computer-it");
    expect(slugify("Electronics & Telecom")).toBe("electronics-telecom");
    expect(BRANCH_GROUP_BY_SLUG["computer-it"]).toBe("Computer & IT");
    expect(BRANCH_GROUP_BY_SLUG["mechanical"]).toBe("Mechanical");
    expect(Object.keys(BRANCH_GROUP_BY_SLUG)).not.toContain("other");
  });
});
