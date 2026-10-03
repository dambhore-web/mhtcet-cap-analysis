/**
 * CET Cell codes, normalised to the 2026 form so every year joins on the same keys.
 * 2023–2025 PDFs print college codes without the leading zero (1002 for 01002), and some lists
 * print 9-digit choice codes (100219110 for 0100219110). Suffix letters on choice codes are kept.
 */

/**
 * Colleges that became universities and got a new code; branch suffixes are unchanged
 * (0600624210 → 1600624210). Verified by name and branch list against the 2026 institute list.
 */
export const COLLEGE_CODE_ALIASES: Readonly<Record<string, string>> = {
  "06006": "16006", // COEP Technological University (2023 → 2024)
  "04005": "14005", // Laxminarayan Institute of Technology → Laxminarayan Innovation Technological University
};

export function normaliseCollegeCode(code: string): string {
  const padded = code.padStart(5, "0");
  return COLLEGE_CODE_ALIASES[padded] ?? padded;
}

export function normaliseChoiceCode(code: string): string {
  const m = /^(\d+)([A-Z]*)$/.exec(code);
  if (!m) return code;
  const digits = m[1].padStart(10, "0");
  return normaliseCollegeCode(digits.slice(0, 5)) + digits.slice(5) + m[2];
}
