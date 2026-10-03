import { BRANCH_GROUP_PATTERNS } from "./branchGroups.ts";

/**
 * URL slugs for the district and branch-group landing pages (SEO): "Mumbai-Suburban" →
 * "mumbai-suburban", "Computer & IT" → "computer-it". Shared by the API, the web app and the
 * build-time page generator so every link and every page agree.
 */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The branch groups that get landing pages, by slug ("Other" has none). */
export const BRANCH_GROUP_BY_SLUG: Record<string, string> = Object.fromEntries(
  Object.keys(BRANCH_GROUP_PATTERNS).map((g) => [slugify(g), g]),
);

/** Fewest colleges a district + branch-group page needs, so no page is thin. */
export const MIN_COLLEGES_PER_GROUP_PAGE = 2;
