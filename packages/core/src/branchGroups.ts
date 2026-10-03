/**
 * Branch groups: the families students choose between (Computer & IT, E&TC, ...). Matched on the
 * official branch name, so no extra data is needed. Shared by the rank finder filters (API) and the
 * option form coverage check (web, #137). Order matters: the first matching group wins.
 */
export const BRANCH_GROUP_PATTERNS: Record<string, RegExp> = {
  "Computer & IT":        /computer|information\s+tech|data\s+sc|artificial\s+int|machine\s+learn|cyber/i,
  "Electronics & Telecom": /electronics|e\.?\s*t\.?\s*c|telecom/i,
  "Mechanical":           /mechanical/i,
  "Civil":                /civil/i,
  "Electrical":           /electrical/i,
  "Chemical":             /chemical|petroleum|plastic/i,
  "Instrumentation":      /instrument/i,
  "Aerospace":            /aeronautical|aerospace/i,
};

export const OTHER_BRANCH_GROUP = "Other";

/** The branch group of an official branch name, or "Other" when none matches. */
export function branchGroupOf(branch: string): string {
  for (const [group, re] of Object.entries(BRANCH_GROUP_PATTERNS)) if (re.test(branch)) return group;
  return OTHER_BRANCH_GROUP;
}
