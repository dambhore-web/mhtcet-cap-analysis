import { z } from "zod";
import { AUTO_FREEZE_TOP_N, CATEGORIES, parseSeatType } from "@mhtcet/core";
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
const MAX_CUTOFFS = 200;

const FindArgs = z.object({
  merit: z.number().int().min(1).max(500000).optional(),
  candidature: z.enum(["MH", "AI"]).default("MH"),
  category: z.enum(CATEGORIES).nullable().optional(),
  gender: z.enum(["M", "F"]).optional(),
  homeUniversity: z.string().max(120).nullable().optional(),
  flags: z.object({ ews: z.boolean(), tfws: z.boolean(), defence: z.boolean(), pwd: z.boolean(), orphan: z.boolean() }).partial().optional(),
  district: z.string().max(60).nullable().optional(),
  branchGroup: z.string().max(40).nullable().optional(),
  onlyReachable: z.boolean().default(true),
});

const CutoffArgs = z.object({
  collegeCode: z.string().regex(/^\d{4,5}$/),
  branch: z.string().max(80).optional(),
  seatType: z.string().max(12).optional(),
});

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
        merit: { type: "integer", description: "State merit number (candidature MH) or All India merit number (AI)" },
        candidature: { type: "string", enum: ["MH", "AI"] },
        category: { type: "string", enum: [...CATEGORIES] },
        gender: { type: "string", enum: ["M", "F"] },
        homeUniversity: { type: "string" },
        district: { type: "string" },
        branchGroup: { type: "string", enum: Object.keys(BRANCH_GROUP_PATTERNS) },
        onlyReachable: { type: "boolean", description: "Only options within reach (default true)" },
      },
    },
  },
  {
    name: "getCutoffs",
    description: "Closing merit for one college by branch, seat type and round, with the official list and page each value came from.",
    parameters: {
      type: "object",
      properties: {
        collegeCode: { type: "string", description: "5-digit CAP college code; use searchColleges to find it" },
        branch: { type: "string", description: "Branch name or part of it" },
        seatType: { type: "string", description: "Seat-type code, e.g. GOPENS" },
      },
      required: ["collegeCode"],
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
        filters: { university: null, district: a.district ?? null, collegeType: null, branchGroup: a.branchGroup ?? null },
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
      const college = cache.colleges.get(a.collegeCode);
      if (!college) throw new ToolError(`No college with code ${a.collegeCode}. Use searchColleges.`);
      const rows: SourceRow[] = [];
      for (const [choiceCode, cutoffs] of cache.cutoffsByChoiceCode) {
        const br = cache.branches.get(choiceCode);
        if (!br || br.collegeCode !== a.collegeCode) continue;
        if (a.branch && !br.name.toLowerCase().includes(a.branch.toLowerCase())) continue;
        for (const r of cutoffs) {
          if (a.seatType && r.seatType !== a.seatType.toUpperCase()) continue;
          rows.push({
            kind: "cutoff",
            label: `${college.name} · ${br.name} · ${r.seatType} · Round ${r.round} (${r.list}) · closing ${r.closingMerit}`,
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
        .filter((c) => c.name.toLowerCase().includes(q) || c.code.includes(q) || (c.district ?? "").toLowerCase().includes(q))
        .slice(0, 10)
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
