# Navigation and user journeys

How users move through the Compass web app, and the questions each path must answer. Every
feature issue names the journey step it completes. Every journey is also an end-to-end test:
if you can walk it, the feature is done.

Source: the clickable mockup "Compass app mockup", board **Start here · user journeys**
(https://claude.ai/artifact/AMQz7i84DpLtphboyZUZuD, private). The older phone mockup
(`7K3x3et9aFdXhbyVx5sLn4`) is superseded for navigation.

## Rules
1. **Top navigation, no sidebar.** It has six places in this order: Find colleges, By branch,
   Colleges, My CAP plan, Ask Compass, CAP guide. On the right: a shortlist counter, and
   Sign in or the account menu. Below 900 px the six places move into a menu. There is no
   left vertical navigation and no bottom tab bar (owner decision).
2. **Three clicks.** Every journey below is answered within three clicks of Home.
3. **Every route is reachable.** A page exists only if the nav, a My CAP plan step or a
   journey step links to it. An orphan route is a bug.
4. **One active place.** Each route belongs to exactly one top-nav place (table below), and
   that place shows as active.
5. **Sub-pages use breadcrumbs,** not back arrows: for example Colleges / COEP / Mechanical.
6. **My CAP plan is a sequence.** Its pages share step tabs, and each step links to the next.
7. **English only** at launch (NFR-005, owner decision).

## First visit (#142)
A visitor with no saved details is sent from `/` to the landing page `/welcome`. "Find my colleges" opens
`/welcome/start`, which asks one question per screen: exam, merit number or percentile, category, gender,
home university, special seats, minority community and branches of interest (JEE skips the state-quota
questions). The answers are saved on the device and open Find colleges with `scan=1`, which shows the
"Checking the CAP lists" screen for about 3 s (none with reduced motion) while the real search runs. Returning
visitors go straight to `/`; the landing page offers them "Continue to my results" and "Start over".

## Site map
| Top-nav place | Page | Route | Status |
|---|---|---|---|
| (first visit) | Landing page: hero, how it works, branch chips, real data counts | `/welcome` | Built (#142) |
| (first visit) | Questions one per screen (9 for MHT-CET, 4 for JEE), then the scan screen | `/welcome/start` | Built (#142) |
| Find colleges | Home and results (what-if slider, ladders, district filter, branch chips from onboarding) | `/` | Built |
| | Percentile estimate (CET and JEE) | `/estimate` | Built |
| | All India seats (JEE Main) | `/?list=AI` via JEE mode | Built; needs the All India merit list in the DB |
| | Seat eligibility | `/eligibility` | Built |
| By branch | One branch across colleges | `/branches` | Built |
| Colleges | Directory (district and type filters when loaded) | `/colleges` | Built |
| | College page | `/colleges/:code` | Built |
| | Branch trends | `/colleges/:code/:choiceCode` | Round movement built; earlier years and seats left need data (#12, #40) |
| | Compare | `/compare` | Built |
| My CAP plan | 1 · Option form | `/list` | Built |
| | 1b · Add options from any college | `/list/add` | Built |
| | 2 · Simulator | `/simulator` | Built |
| | 3 · Export for CAP portal | `/export` | Built |
| | 4 · After allotment | `/allotment` | Built |
| | 5 · Family summary | `/summary` | Built |
| Ask Compass | Chat with cited answers | `/ask` | Built (grounded) |
| CAP guide | Steps, seat codes, FAQ | `/guide` | Built |
| (footer) | Where our numbers come from | `/data` | Built |
| (footer) | Disclaimer, privacy, terms | `/legal` | Built |
| (account) | Sign in | `/signin` | Placeholder (#15) |
| (account) | Account: details, saved work, CAP calendar | `/profile` | Details only (#117) |
| (account) | Plans, checkout, receipt | `/plans` | Plans page only (#21, #34) |

## My CAP plan steps
1. Shortlist & option form
2. Test in simulator
3. Export for CAP portal
4. After allotment
5. Family summary

All five steps are linked, and each page ends with a "Next step" link.

## The 14 journeys
The tier (Free or Plus) comes from the mockup. The free vs paid split is still
`DECISION REQUIRED` (`01-requirements/pricing-and-plans.md`), so treat the tiers as
provisional.

| # | The user's question | Who | Path | Tier | Done when | Issues |
|---|---|---|---|---|---|---|
| J1 | "Which colleges could I get with my merit number?" | Student, after the merit list | Landing → Questions → Scan → Results → College page | Free | Results show branch and college counts, a ladder per college and a what-if slider | #87, #88, #86 |
| J2 | "I only have my percentile. Where do I stand?" | Student, before the merit list | Landing → Questions (percentile) → Scan → Results, or Home → Estimate → Results | Free | The estimated merit is shown as a range and labelled "estimated" wherever it is used | #88 |
| J3 | "Where can I study Computer Engineering?" | Student with a branch in mind | By branch → College page → Option form | Free | One row per college for that branch, Round I and IV against your merit, add to option form | #79, #81, #113 |
| J4 | "What were the cutoffs at COEP?" | Student or parent | Colleges → College page → Branch trends | Free | Every branch and round for your eligible seat types, then four-year trends | #86, #85, #12, #40 |
| J5 | "Is COEP or Sahyadri better for me?" | Family | College page → Compare | Free | Up to three colleges on one ladder scale, with fees and your best branch at each | #92, #42 |
| J6 | "Do TFWS, EWS or Defence seats help me?" | Student with a possible reservation | Home → Seat eligibility → Results | Free | Each seat type explained, proof needed, and how many branches it adds | #82 |
| J7 | "I applied through JEE Main." | All India candidate | Home → All India → College page | Free | Results from the All India merit list, with state-quota results one click away | #8 |
| J8 | "In what order should I fill my option form?" | Student before the deadline | Results → Option form → Add options → Export | Free | Ordered list with freeze-zone markers and checks, exported with choice codes (PDF, Excel) | #90, #113, #83, #80 |
| J9 | "Where would this list actually land me?" | Student testing their order | Option form → Simulator | Plus | Round I–IV replay of last year with the auto-freeze rule | #36, #89 |
| J10 | "I got a seat. Freeze or float?" | Student after each allotment | Account → After allotment → Family summary | Plus | Which higher options opened last year, the three choices, deadline and fees | #84, #117, #116 |
| J11 | "What exactly is our plan?" | Parent, via a shared link | Family summary | Plus | One page: current seat, top options, risks, costs, next dates | #116 |
| J12 | "How does CAP work? What is GOPENS?" | First-time parent | CAP guide → Seat eligibility → Ask | Free | Steps, how to read a seat code, FAQ, then a cited answer | #82, #18, #91 |
| J13 | "Can I trust these numbers?" | Sceptical parent | Data sources → Legal | Free | How lists are read and checked, freshness dates, the disclaimer | #114 |
| J14 | "I want the simulator and assistant." | Student upgrading | Plans → Sign in → Checkout → Receipt → Simulator | Plus | Plans, Google sign-in, payment, and a receipt that leads into the simulator | #34, #15, #21, #22 |

## Journey status
J1–J13 each have a Playwright spec in `apps/web/e2e/journeys/`, run on every PR into Dev and main
over the demo dataset. J14 (upgrade: sign-in, checkout, receipt) is blocked on #15, #21 and #34.

Still missing inside passing journeys:
- **J4:** four-year trends and seats left need #12 and #40.
- **J10:** the account start page needs #117.

## Testing
Each journey has a Playwright spec in `apps/web/e2e/journeys/` that clicks through its path and
checks the "Done when" column (#112). `apps/web/test/routes.test.ts` fails if any route in `App.tsx`
has no link to it (rule 3).
