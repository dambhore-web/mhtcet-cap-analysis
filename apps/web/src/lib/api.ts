export type Category = "OPEN" | "OBC" | "SEBC" | "SC" | "ST" | "VJ" | "NT1" | "NT2" | "NT3";
export type RankStatus = "round-I" | "later-round" | "out-of-range";

export interface ResultFilters {
  university?: string | null;
  district?: string | null;
  collegeType?: string | null;
  branchGroup?: string | null;
  branch?: string | null;
}

/** MH: state merit number, state-quota seats. AI: All India merit number, All India seats (JEE Main). */
export type Candidature = "MH" | "AI";

export const BRANCH_GROUPS = [
  "Computer & IT",
  "Electronics & Telecom",
  "Mechanical",
  "Civil",
  "Electrical",
  "Chemical",
  "Instrumentation",
  "Aerospace",
] as const;

export interface FindRequest {
  year?: number;
  merit: number;
  candidature?: Candidature;
  homeUniversity: string | null;
  category: Category | null;
  gender: "M" | "F";
  minorityCommunity: string | null;
  flags: { ews: boolean; tfws: boolean; defence: boolean; pwd: boolean; orphan: boolean };
  subjectGroup: "PCM" | "PCB";
  filters?: ResultFilters;
}

export interface SourceRef {
  file: string;
  page: number | null;
}

export interface FindOption {
  collegeCode: string;
  collegeName: string;
  district?: string | null;
  collegeType?: string | null;
  choiceCode: string;
  branch: string;
  list?: Candidature;
  seatType: string;
  status: RankStatus;
  round: number | string | null;
  closingMerit: number;
  /** Round I closing for this seat type (null if it had no Round I value). */
  firstRoundClosing?: number | null;
  /** Closing in the last published round. */
  lastRoundClosing?: number | null;
  rounds?: { round: string; closingMerit: number }[];
  /** Official list and page behind closingMerit (NFR-001). */
  source?: SourceRef | null;
  year: number;
}

export interface FindResponse {
  options: FindOption[];
  count: number;
}

export interface College {
  code: string;
  name: string;
  status: string | null;
  homeUniversity: string | null;
  district?: string | null;
  collegeType?: string | null;
}

export interface DataMeta {
  year: number;
  colleges: number;
  branches: number;
  cutoffRows: number;
  lists: { list: string; round: string; rows: number; files: string[] }[];
  districtsLoaded: number;
  fees: { colleges: number; verified: number };
  loads: { id: string; startedAt: string; finishedAt: string | null; status: string }[];
}

const BASE = import.meta.env.VITE_API_URL ?? "";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export interface MeritEstimate {
  percentile: number;
  subjectGroup: string;
  year: number;
  estimatedMeritRange: [number, number];
  sampleSize: number | null;
  method: "data" | "statistical";
  disclaimer: string;
}

export interface CollegeFees {
  available: true;
  code: string;
  name: string;
  year: string;
  fees: { tuitionFee: number; developmentFee: number; otherFees: number; totalAnnualFee: number };
  tfwsAvailable: boolean;
  tfwsSeats: number | null;
  fraOrderRef: string | null;
  fraOrderUrl: string | null;
  sampleOnly: boolean;
  /** True when the amounts link to the Fee Regulating Authority's order. */
  verified?: boolean;
  disclaimer: string;
}

export interface CollegeFeesUnavailable {
  available: false;
  code: string;
}

export interface SimulateRequest {
  merit: number;
  homeUniversity: string | null;
  category: Category | null;
  gender: "M" | "F";
  minorityCommunity: string | null;
  flags: { ews: boolean; tfws: boolean; defence: boolean; pwd: boolean; orphan: boolean };
  subjectGroup: "PCM" | "PCB";
  candidature?: Candidature;
  preferences: string[];
}

export interface SimulatedChoice {
  choiceCode: string;
  collegeCode: string | null;
  collegeName: string | null;
  branch: string | null;
  known: boolean;
}

export interface SimulatedRound {
  round: "I" | "II" | "III" | "IV";
  preference: number | null;
  seatType: string | null;
  closingMerit: number | null;
  movedUp: boolean;
  frozen: boolean;
  frozenEarlier: boolean;
  choice: SimulatedChoice | null;
}

export interface SimulateResponse {
  rounds: SimulatedRound[];
  grid: (SimulatedChoice & { preference: number; byRound: Partial<Record<SimulatedRound["round"], { seatType: string; closingMerit: number } | null>> })[];
  freezeZones: Partial<Record<SimulatedRound["round"], number>>;
  assumptions: string;
}

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantProfile {
  merit?: number | null;
  category?: string | null;
  gender?: string | null;
  homeUniversity?: string | null;
}

export const api = {
  find: (req: FindRequest) => post<FindResponse>("/api/rank-finder", req),
  simulate: (req: SimulateRequest) => post<SimulateResponse>("/api/simulate", req),
  colleges: (q: string, university?: string, filters: { district?: string; type?: string } = {}) =>
    get<{ colleges: College[]; count: number; total: number; districts?: string[]; collegeTypes?: string[] }>(
      `/api/colleges?q=${encodeURIComponent(q)}&university=${encodeURIComponent(university ?? "")}` +
        `&district=${encodeURIComponent(filters.district ?? "")}&type=${encodeURIComponent(filters.type ?? "")}&limit=400`
    ),
  branches: () => get<{ branches: string[] }>("/api/branches"),
  meta: () => get<DataMeta>("/api/meta"),
  collegeCutoffs: (code: string) =>
    get<{
      college: { code: string; name: string; status?: string | null; homeUniversity?: string | null; district?: string | null; collegeType?: string | null; totalIntake?: number | null };
      year: number;
      cutoffs: object[];
    }>(
      `/api/colleges/${code}/cutoffs`
    ),
  meritEstimate: (percentile: number, subjectGroup: "PCM" | "PCB") =>
    get<MeritEstimate>(
      `/api/merit-estimate?percentile=${percentile}&subjectGroup=${subjectGroup}`
    ),
  collegeFees: (code: string) =>
    get<CollegeFees | CollegeFeesUnavailable>(`/api/colleges/${code}/fees`),
  jeeEstimate: (percentile: number) =>
    get<{
      percentile: number;
      estimatedRank: number;
      rankRange: [number, number];
      totalCandidates: number;
      year: number;
      method: string;
      disclaimer: string;
    }>(`/api/jee-estimate?percentile=${percentile}`),

  /** Returns a ReadableStream reader, or throws AssistantError on known error codes. */
  assistantStream: async (
    messages: AssistantMessage[],
    profile?: AssistantProfile,
  ): Promise<ReadableStreamDefaultReader<Uint8Array>> => {
    const res = await fetch(`${BASE}/api/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, profile }),
    });
    if (res.status === 429) {
      const body = await res.json() as { message?: string; upgradeUrl?: string };
      throw Object.assign(new Error(body.message ?? "rate_limited"), { code: "rate_limited", upgradeUrl: body.upgradeUrl });
    }
    if (res.status === 503) throw Object.assign(new Error("assistant_unavailable"), { code: "assistant_unavailable" });
    if (!res.ok || !res.body) throw Object.assign(new Error("stream_error"), { code: "stream_error" });
    return res.body.getReader();
  },
};
