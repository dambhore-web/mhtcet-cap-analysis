import type { Category } from "./api";

/** Category choices shown to students. NT1/NT2/NT3 in CET Cell codes are NT-B, NT-C and NT-D. */
export const CATEGORY_OPTIONS: { value: Category | ""; label: string; desc: string }[] = [
  { value: "", label: "Open", desc: "General" },
  { value: "OBC", label: "OBC", desc: "Other Backward Class" },
  { value: "SEBC", label: "SEBC", desc: "Socially and Educationally Backward Class" },
  { value: "SC", label: "SC", desc: "Scheduled Caste" },
  { value: "ST", label: "ST", desc: "Scheduled Tribe" },
  { value: "VJ", label: "VJ/DT", desc: "Vimukta Jati / Denotified Tribe (NT-A)" },
  { value: "NT1", label: "NT-B", desc: "Nomadic Tribe B" },
  { value: "NT2", label: "NT-C", desc: "Nomadic Tribe C" },
  { value: "NT3", label: "NT-D", desc: "Nomadic Tribe D" },
];

export const FLAG_OPTIONS = [
  { key: "ews", label: "EWS", desc: "Economically weaker section" },
  { key: "tfws", label: "TFWS", desc: "Tuition fee waiver (family income up to ₹8 lakh)" },
  { key: "defence", label: "Defence", desc: "Child of defence personnel" },
  { key: "pwd", label: "PWD", desc: "Person with disability" },
  { key: "orphan", label: "Orphan", desc: "Orphan candidate" },
] as const;
