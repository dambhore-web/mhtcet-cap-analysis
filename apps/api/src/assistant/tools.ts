import { z } from "zod";
import { AUTO_FREEZE_TOP_N, CATEGORIES, normalizeStage, parseSeatType } from "@mhtcet/core";

const ROUNDS = ["I", "II", "III", "IV"] as const;
import type { AppCache } from "../startup.ts";
import { BRANCH_GROUP_PATTERNS, findOptions } from "../services/findOptions.ts";

/**
 * AG-001 product tools (docs/06-agents/tools-registry.md). Read-only, run over the in-memory
 * cutoff cache, arguments validated, results size-capped. Every row a tool returns becomes a
 * citable source.
 */

export interface SourceRow {
  /** Citation id shown to the user, e.g. "S3". Assigned by the runner. */
  id?: string;
  kind: "cutoff" | "option" | "college" | "rule" | "seat-type";
  label: string;
  collegeCode?: string;
  choiceCode?: string;
  branch?: string;
  seatType?: string;
  round?: string;
  closingMerit?: number;
  list?: string;
  year?: number;
  sourceFile?: string | null;
  sourcePage?: number | null;
}

export interface ToolContext {
  cache: AppCache;
  profile: { merit?: number | null; category?: string | null; gender?: string | null; homeUniversity?: string | null };
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

const MAX_OPTIONS = 50;
/** Enough for every round of a few seat types; the model narrows by branch or seat type for more. */
export const MAX_CUTOFFS = 60;

const FindArgs = z.object({
  // Models send null for details the student hasn't given; treat it as not given
  merit: z.number().int().min(1).max(500000).nullish(),
  candidature: z.enum(["MH", "AI"]).default("MH"),
  category: z.enum(CATEGORIES).nullable().optional(),
  gender: z.enum(["M", "F"]).nullish(),
  homeUniversity: z.string().max(120).nullable().optional(),
  flags: z.object({ ews: z.boolean(), tfws: z.boolean(), defence: z.boolean(), pwd: z.boolean(), orphan: z.boolean() }).partial().optional(),
  district: z.string().max(60).nullable().optional(),
  branchGroup: z.string().max(40).nullable().optional(),
  onlyReachable: z.boolean().default(true),
});

const CutoffArgs = z
  .object({
    // A name, initials ("PICT") or code; collegeCode is the older, code-only form
    college: z.string().min(2).max(120).nullish(),
    collegeCode: z.string().regex(/^\d{4,5}$/).nullish(),
    branch: z.string().max(80).nullish(),
    seatType: z.string().max(12).nullish(),
    round: z.enum(ROUNDS).nullish(),
  })
  .refine((a) => a.college || a.collegeCode, { message: "Give the college (name, initials or code)." });

const SearchArgs = z.object({ query: z.string().min(2).max(80) });
const SeatArgs = z.object({ code: z.string().min(2).max(12) });

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "findOptions",
    description:
      "Rank finder: which college-branch options a merit number reached last year, with seat type, status (round-I, later-round, out-of-range), round and closing merit. Uses the student's profile for anything not given.",
    parameters: {
      type: "object",
      properties: {
        // Nullable: models send null for details the student hasn't given, and Groq rejects the
        // whole call when that doesn't match the schema
        merit: { type: ["integer", "null"], description: "State merit number (candidature MH) or All India merit number (AI); omit to use the student's saved merit" },
        candidature: { type: "string", enum: ["MH", "AI"] },
        category: { type: ["string", "null"], enum: [...CATEGORIES, null] },
        gender: { type: ["string", "null"], enum: ["M", "F", null] },
        homeUniversity: { type: ["string", "null"] },
        district: { type: ["string", "null"] },
        branchGroup: { type: ["string", "null"], enum: [...Object.keys(BRANCH_GROUP_PATTERNS), null] },
        onlyReachable: { type: "boolean", description: "Only options within reach (default true)" },
      },
    },
  },
  {
    name: "getCutoffs",
    description:
      "Closing merit at one college from the official cutoff lists. Pass everything the student named: college, branch, seat type and round. Without a round it returns Round I; without a seat type it returns one row per seat type.",
    parameters: {
      type: "object",
      properties: {
        college: { type: "string", description: "College name, common initials (COEP, VJTI, PICT) or 5-digit CAP code" },
        branch: { type: ["string", "null"], description: "Branch name, part of it or a common short form (Computer, IT, ENTC, Mechanical)" },
        seatType: { type: ["string", "null"], description: "Seat-type code, e.g. GOPENS, LOPENS, TFWS, EWS" },
        round: { type: ["string", "null"], enum: [...ROUNDS, null], description: "CAP round; omit for Round I" },
      },
      required: ["college"],
    },
  },
  {
    name: "searchColleges",
    description: "Find colleges by name, code or district. Returns up to 10.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "explainSeatType",
    description: "Plain-language meaning of a CAP seat-type code such as GOPENH or LOBCS.",
    parameters: { type: "object", properties: { code: { type: "string" } }, required: ["code"] },
  },
  {
    name: "capRules",
    description: "The CAP auto-freeze rule and what Freeze, Float and Slide mean.",
    parameters: { type: "object", properties: {} },
  },
];

export class ToolError extends Error {}

/** Short forms students use for branches, mapped to words that appear in the official branch names. */
const BRANCH_ALIASES: [RegExp, string][] = [
  [/^(comp|comps|computer|cs|cse|co)$/i, "computer"],
  [/^(it|info\.? ?tech)$/i, "information technology"],
  [/^(entc|e&tc|extc|etc|e ?& ?tc|electronics and telecom(munication)?)$/i, "telecommunication"],
  [/^(mech|mechanical)$/i, "mechanical"],
  [/^(aiml|ai ?& ?ml|ai|artificial intelligence)$/i, "artificial intelligence"],
  [/^(ds|data science)$/i, "data science"],
];

/** Whether an official branch name matches what the student called it. */
export function branchMatches(name: string, asked: string): boolean {
  const q = asked.trim();
  const alias = BRANCH_ALIASES.find(([re]) => re.test(q))?.[1];
  return name.toLowerCase().includes((alias ?? q).toLowerCase());
}

/**
 * The one college a name, initials or code points at. Several equally good matches is an error
 * that lists them, so the model asks or retries with the code rather than guessing.
 */
export function resolveCollege(cache: AppCache, query: string): { code: string; name: string } {
  const code = query.trim();
  if (/^\d{4,5}$/.test(code)) {
    const c = cache.colleges.get(code.padStart(5, "0"));
    if (!c) throw new ToolError(`No college with code ${code}. Use searchColleges.`);
    return c;
  }
  const scored = [...cache.colleges.values()].map((c) => ({ c, score: collegeMatch(c, code.toLowerCase()) })).filter((x) => x.score > 0);
  if (!scored.length) throw new ToolError(`No college matches "${query}". Use searchColleges.`);
  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((x) => x.score === scored[0].score);
  if (top.length > 1) {
    throw new ToolError(`"${query}" matches several colleges: ${top.slice(0, 5).map((x) => `${x.c.name} (code ${x.c.code})`).join("; ")}. Call again with the code.`);
  }
  return top[0].c;
}

/** Words in almost every college name: matching on them alone would find hundreds. */
const GENERIC_WORDS = new Set(["institute", "college", "engineering", "technology", "technological", "university", "of", "and", "the"]);

const SMALL_WORDS = new Set(["of", "and", "the", "&", "for", "in"]);

/** Initials people use for colleges: "Pune Institute of Computer Technology" → pict, "College of Engineering Pune" → coep. */
export function collegeInitials(name: string): string[] {
  const words = name.toLowerCase().replace(/[^a-z& ]/g, " ").split(/\s+/).filter(Boolean);
  const all = words.map((w) => w[0]).join("");
  const main = words.filter((w) => !SMALL_WORDS.has(w)).map((w) => w[0]).join("");
  return [...new Set([all, main])];
}

/**
 * How well a college matches a search: the whole query in the name, code or district scores
 * highest; otherwise one point per query word found in them or equal to the college's initials.
 * So "COEP", "PICT Pune" and "Vishwakarma" all find their college.
 */
function collegeMatch(c: { name: string; code: string; district?: string | null }, q: string): number {
  const name = c.name.toLowerCase();
  const district = (c.district ?? "").toLowerCase();
  if (name.includes(q) || c.code.includes(q) || (district && district.includes(q))) return 100;
  const initials = collegeInitials(c.name);
  let score = 0;
  for (const word of q.split(/[^a-z0-9&]+/).filter((w) => w.length >= 2 && !GENERIC_WORDS.has(w))) {
    if (initials.includes(word)) score += 3;
    else if (word.length >= 3 && (name.includes(word) || district === word || c.code === word)) score += 1;
  }
  return score;
}

const QUOTA: Record<string, string> = { G: "General", L: "Ladies", PWD: "Disability (PWD)", PWDR: "Disability (PWD), common", DEF: "Defence", DEFR: "Defence, common" };
const CATEGORY: Record<string, string> = { NT1: "NT-B", NT2: "NT-C", NT3: "NT-D", VJ: "VJ/DT", OPEN: "open" };
const STANDALONE: Record<string, string> = {
  TFWS: "Tuition fee waiver", EWS: "Economically weaker section", MI: "Minority", ORPHANI: "Orphan", ORPHANN: "Orphan", AI: "All India (JEE Main / All India merit)",
};

function describeSeat(code: string): string {
  const p = parseSeatType(code);
  if (!p) return `${code}: not a recognised seat type`;
  if (p.kind === "standalone") return `${code}: ${STANDALONE[p.standalone] ?? p.standalone} seat`;
  const level = { S: "state level", H: "home university", O: "other than home university" }[p.level] ?? p.level;
  return `${code}: ${QUOTA[p.quota] ?? p.quota} ${CATEGORY[p.category] ?? p.category}, ${level}`;
}

export function runTool(name: string, rawArgs: unknown, ctx: ToolContext): SourceRow[] {
  const { cache, profile } = ctx;
  switch (name) {
    case "findOptions": {
      const a = FindArgs.parse(rawArgs ?? {});
      const merit = a.merit ?? profile.merit ?? null;
      if (!merit) throw new ToolError("No merit number: ask the student for it.");
      const options = findOptions(cache, {
        year: cache.year,
        merit,
        candidature: a.candidature,
        homeUniversity: a.homeUniversity ?? profile.homeUniversity ?? null,
        category: (a.category ?? (profile.category as (typeof CATEGORIES)[number] | null) ?? null) || null,
        gender: a.gender ?? (profile.gender === "F" ? "F" : "M"),
        minorityCommunity: null,
        flags: { ews: false, tfws: false, defence: false, pwd: false, orphan: false, ...(a.flags ?? {}) },
        subjectGroup: "PCM",
        filters: { university: null, district: a.district ?? null, collegeType: null, branchGroup: a.branchGroup ?? null, branch: null },
      });
      return options
        .filter((o) => !a.onlyReachable || o.status !== "out-of-range")
        .slice(0, MAX_OPTIONS)
        .map((o) => ({
          kind: "option",
          label: `${o.collegeName} · ${o.branch} · ${o.seatType} · ${o.status === "round-I" ? "Round I" : o.status === "later-round" ? `Round ${o.round}` : "out of reach"} · closing ${o.closingMerit}`,
          collegeCode: o.collegeCode,
          choiceCode: o.choiceCode,
          branch: o.branch,
          seatType: o.seatType,
          round: o.round,
          closingMerit: o.closingMerit,
          list: o.list,
          year: o.year,
          sourceFile: o.source?.file ?? null,
          sourcePage: o.source?.page ?? null,
        }));
    }
    case "getCutoffs": {
      const a = CutoffArgs.parse(rawArgs ?? {});
      const college = resolveCollege(cache, (a.college ?? a.collegeCode)!);
      const seatType = a.seatType?.toUpperCase() ?? null;
      const round = a.round ?? "I";
      const list = seatType === "AI" ? "AI" : "MH";
      const rows: SourceRow[] = [];
      for (const [choiceCode, cutoffs] of cache.cutoffsByChoiceCode) {
        const br = cache.branches.get(choiceCode);
        if (!br || br.collegeCode !== college.code) continue;
        if (a.branch && !branchMatches(br.name, a.branch)) continue;
        for (const r of cutoffs) {
          if (r.list !== list || r.round !== round) continue;
          if (seatType && r.seatType !== seatType) continue;
          const stage = r.stage && normalizeStage(r.stage) !== "I" ? `, stage ${r.stage}` : "";
          rows.push({
            kind: "cutoff",
            label: `${college.name} · ${br.name} · ${r.seatType} · Round ${r.round}${stage} · closing ${r.closingMerit}`,
            collegeCode: college.code,
            choiceCode,
            branch: br.name,
            seatType: r.seatType,
            round: r.round,
            closingMerit: r.closingMerit,
            list: r.list,
            year: r.year,
            sourceFile: r.sourceFile,
            sourcePage: r.sourcePage,
          });
          if (rows.length >= MAX_CUTOFFS) return rows;
        }
      }
      return rows;
    }
    case "searchColleges": {
      const q = SearchArgs.parse(rawArgs ?? {}).query.toLowerCase();
      return [...cache.colleges.values()]
        .map((c) => ({ c, score: collegeMatch(c, q) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((x) => x.c)
        .map((c) => ({ kind: "college", label: `${c.name} (code ${c.code}${c.district ? `, ${c.district}` : ""})`, collegeCode: c.code }));
    }
    case "explainSeatType": {
      const { code } = SeatArgs.parse(rawArgs ?? {});
      return [{ kind: "seat-type", label: describeSeat(code.toUpperCase()), seatType: code.toUpperCase() }];
    }
    case "capRules":
      return [
        {
          kind: "rule",
          label: `Auto-freeze (2025-26 brochure): allotted to option 1 in Round I, options 1–${AUTO_FREEZE_TOP_N.II} in Round II or 1–${AUTO_FREEZE_TOP_N.III} in Round III locks the seat. Round IV allotments are final.`,
        },
        { kind: "rule", label: "Freeze: accept the seat and stop. Float: accept and stay in line for higher choices at any college. Slide: accept and stay in line only for higher choices at the same college." },
      ];
    default:
      throw new ToolError(`Unknown tool ${name}`);
  }
}
