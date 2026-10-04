import { slugify } from "@mhtcet/core";

/**
 * Each branch group has its own page, /branches/computer-it (SEO step 3): a real address search
 * engines can index, where ?group= was one page for all of them. Slugs as the district group pages.
 */
export const BRANCH_GROUP_HUB = "/branches";
export const branchGroupPath = (group: string) => `/branches/${slugify(group)}`;

export function groupFromSlug<G extends string>(slug: string | undefined, groups: readonly G[]): G | null {
  if (!slug) return null;
  return groups.find((g) => slugify(g) === slug) ?? null;
}
