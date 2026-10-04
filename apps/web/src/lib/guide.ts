/**
 * The CAP guide's text (/guide), shared by the page and the prerendered HTML (scripts/prerender.ts),
 * so what search engines read is what the page says.
 */

export const CAP_STEPS = [
  { title: "Register and verify documents", body: "Fill the CAP application on the CET Cell portal and get your documents verified (e-scrutiny or at a facilitation centre)." },
  { title: "Check the merit lists", body: "A provisional merit list is published first, then the final state merit list. Your state merit number is your rank in it." },
  { title: "Fill the option form", body: "List up to 300 choice codes (college + branch) in the order you prefer them. Order matters: you are allotted the highest choice your rank qualifies for." },
  { title: "Round I allotment", body: "CET Cell publishes the allotment. If you got a seat, you choose to freeze, float or slide, and report online or at the institute." },
  { title: "Rounds II and III", body: "Seats left after each round are re-allotted. You can edit your option form between rounds. Later rounds usually close at higher (easier) ranks." },
  { title: "Report to the institute", body: "Once you freeze a seat, report to the college with original documents and pay the fees before the deadline." },
];

/** One line each for freeze, float and slide: the prerendered summary of the three guide sections. */
export const DECISIONS = [
  {
    id: "freeze",
    title: "Freeze",
    summary: "You accept the allotted college and branch as your final choice. No further upgrades are attempted, and you take no part in later CAP rounds.",
  },
  {
    id: "float",
    title: "Float",
    summary: "You keep your current seat and take part in the next round for a higher preference at any college. If a better seat opens you move to it; if not, you keep the current one.",
  },
  {
    id: "slide",
    title: "Slide",
    summary: "You stay at the same college but can move to a higher-preference branch there if a seat opens. Your college does not change.",
  },
] as const;

export const FAQS = [
  {
    q: "What is the difference between freeze, float and slide in CAP?",
    a: "Freeze accepts the allotted seat as final. Float keeps your seat and tries for a higher preference at any college in the next round. Slide keeps your college and tries for a higher-preference branch at the same college.",
  },
  {
    q: "Can I change my option (Freeze/Float/Slide) after submitting?",
    a: "You can change your option until the option-form deadline. Once the round processing begins, the submitted option is final for that round.",
  },
  {
    q: "If I Float and get upgraded, do I lose the original seat?",
    a: "Yes — when you Float and receive a higher preference, the original seat is automatically released for other candidates. Ensure you are okay with this.",
  },
  {
    q: "Can I select both Float and Slide?",
    a: "Yes. Float applies across colleges; Slide applies within the same college. You can select Slide as a preference-within-college option and also Float to allow cross-college upgrades.",
  },
  {
    q: "What if I don't submit any option?",
    a: "If you fail to submit an option within the deadline, the default is typically treated as Freeze. Always verify the default for the current year in the official CAP brochure.",
  },
  {
    q: "How many CAP rounds are there?",
    a: "There are usually 3 main CAP rounds (Round I, II, III) followed by an Institute Level round and sometimes an ARC (Admission Reporting Centre) round for vacant seats. The exact count may vary year to year.",
  },
  {
    q: "What does GOPENS mean in the CAP cutoff list?",
    a: "Seat codes join three parts: who the seat is for, the category and the level. GOPENS is G (general, open to all) + OPEN (open category) + S (state level). GOPENH is the home-university open seat and GOPENO the other-than-home-university one.",
  },
  {
    q: "What is a home university seat?",
    a: "Most university-affiliated colleges keep a share of seats for candidates from the same university area (H seats) and the rest for candidates from outside it (O seats). Which one you compete for depends on where you passed Class 12.",
  },
  {
    q: "What is TFWS?",
    a: "Tuition Fee Waiver Scheme seats waive the tuition fee for eligible students whose family income is within the limit set for the year. They have their own seat code (TFWS) and their own closing merit numbers.",
  },
  {
    q: "Is the MHT-CET percentile the same as the merit number?",
    a: "No. The percentile compares you with everyone in your exam session; the state merit number is your rank in the CAP merit list, published after registration. CAP allots seats by merit number, and every cutoff list prints both for the last student admitted.",
  },
  {
    q: "What documents do I need at the reporting centre?",
    a: "Typically: MHT-CET mark statement, Class 10 & 12 mark sheets, domicile certificate, caste certificate (if applicable), Aadhaar, category validity certificate, and the allotment letter. Always check the official DTE circular for the current year.",
  },
];
