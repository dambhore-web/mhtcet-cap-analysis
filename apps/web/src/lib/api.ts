export type Category = "OPEN" | "OBC" | "SEBC" | "SC" | "ST" | "VJ" | "NT1" | "NT2" | "NT3";
export type RankStatus = "round-I" | "later-round" | "out-of-range";

export interface FindRequest {
  year?: number;
  merit: number;
  homeUniversity: string | null;
  category: Category | null;
  gender: "M" | "F";
  minorityCommunity: string | null;
  flags: { ews: boolean; tfws: boolean; defence: boolean; pwd: boolean; orphan: boolean };
  subjectGroup: "PCM" | "PCB";
}

export interface FindOption {
  collegeCode: string;
  collegeName: string;
  choiceCode: string;
  branch: string;
  seatType: string;
  status: RankStatus;
  round: number | null;
  closingMerit: number;
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

export const api = {
  find: (req: FindRequest) => post<FindResponse>("/api/rank-finder", req),
  colleges: (q: string) =>
    get<{ colleges: College[]; count: number }>(`/api/colleges?q=${encodeURIComponent(q)}&limit=50`),
  collegeCutoffs: (code: string) =>
    get<{ college: { code: string; name: string }; year: number; cutoffs: object[] }>(
      `/api/colleges/${code}/cutoffs`
    ),
  meritEstimate: (percentile: number, subjectGroup: "PCM" | "PCB") =>
    get<MeritEstimate>(
      `/api/merit-estimate?percentile=${percentile}&subjectGroup=${subjectGroup}`
    ),
};
