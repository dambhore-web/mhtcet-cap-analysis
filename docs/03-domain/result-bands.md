# Result bands: Likely, Target, Reach

Find colleges (#136) sorts every option into one band so a student can see the shape of their
list at a glance. The rule lives in `packages/core/src/bands.ts` (`bandOf`); the web app only
displays it.

| Band | Rule (against the same seat last year) |
| --- | --- |
| Likely | The merit number was within the **Round I** closing. |
| Target | Not within Round I, but within the closing of a **later round**. |
| Reach | Outside every round's closing, but **at most 10% worse** than the loosest closing. |
| Out of reach | More than 10% worse. Not shown as a tile. |

"10% worse" means `merit <= closing × 1.10`. With a closing of 10,000, merit 11,000 is Reach and
11,001 is out. The 10% margin was chosen by the owner on 2026-10-02 (`REACH_MARGIN`).

## Wording

- Never "safe" or "guaranteed": every band describes last year's closing, not this year's outcome.
  The tiles carry the note "Based on last year's closing ranks, not a guarantee."
- Badges on each option lead with the band and keep the round, e.g. "Likely · Round I",
  "Target · Round III", so the badge and the tile always agree.
- Colour is never the only signal: each band has its own icon and text; Reach is drawn dashed.
