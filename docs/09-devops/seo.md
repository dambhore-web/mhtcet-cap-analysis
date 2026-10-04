# SEO

**What's in place (2026-10-04)**
- Every page sets its own title, description, canonical URL and share-preview tags
  (`apps/web/src/lib/seo.ts`, `usePageMeta`). College and branch pages build them from the data:
  name, district, number of branches, years. The public pages' fixed titles live in
  `STATIC_PAGE_META`. Wording follows the copy rules: past closing ranks, never "you can get".
- Personal or state-dependent pages carry `noindex`: Find colleges results, option form, Add
  options, Compare, Ask, My account, My details, sign-in, simulator, after allotment, export, family
  summary, onboarding. So do missing colleges and branches.
- `robots.txt` and `sitemap.xml` are written by the web build (`scripts/write-seo-files.mjs`):
  - without `VITE_SITE_URL` (local, staging, previews): `robots.txt` blocks every crawler, no sitemap;
  - with it (production only): crawling allowed except `/summary` (its links carry a student's
    details), and a sitemap of the public pages plus every college and branch page with cutoffs
    (2,920 URLs on the 2026 data, with the district pages), from the API's `GET /api/sitemap`. The build fails if that call
    fails, rather than shipping without a sitemap.
- **Prerendered pages** (`scripts/prerender.ts`, production only, like the sitemap): the build
  writes a ready-made HTML file for every public URL (2,919 on the 2026 data) from the API's
  `GET /api/seo-pages`. Each has that page's own title, description, canonical URL, share tags,
  structured data (`WebPage` about a `CollegeOrUniversity`, `BreadcrumbList`; `WebSite` on the home
  page) and a plain-HTML version of its key content (a college's branches with Round I and
  last-round closing on open seats). The app starts over it as usual. Crawlers and link previews
  that don't run JavaScript now see the real page.
- **College and branch pages** (2,720 on the 2026 data, median about 480 words): a lead sentence
  with the real numbers ("closed at merit 150 (99.976 percentile) in CAP 2026 Round I on open seats,
  170 in the last round"), a year-on-year trend in plain words, facts (seats, fee, NIRF salary, All
  India closing), the Round I closing per category seat type (OBC, SC, ST, EWS, TFWS, ladies…), open
  seats year by year, a short FAQ (visible, and as `FAQPage` data), and links to the college's other
  branches, similar cutoffs in the same district and branch group, and the district pages. Titles
  lead with the search words ("… cutoff, COEP Technological University — CAP 2024–2026"), and the
  descriptions carry the numbers. The app sets the same title and description (`collegeMeta`,
  `branchMeta`, `openClosing` in `src/lib/seo.ts`), so the page Google renders says the same as the
  prerendered one. Data: `GET /api/seo-pages` (percentiles, intake, earlier years, seat types, All
  India) plus the district data for fees, salaries and neighbours.
- **Guide, estimate and branch-group pages** (SEO step 3, the high-volume searches):
  - `/guide` renders every section (the tabs only show and hide them), so search engines read all of
    it; its text lives in `src/lib/guide.ts`, shared with the prerendered page and its `FAQPage` data.
  - `/estimate` shows "MHT-CET percentile vs merit number" and "JEE Main percentile vs All India
    merit number" tables for the year, read off the printed pairs (`percentileRows`,
    `GET /api/percentile-scale`), and the questions from `estimateFaqs`, in the app and prerendered.
  - `/branches/computer-it` and one page per branch group (`src/lib/branchGroups.ts`): every college
    offering the group across Maharashtra, hardest to get first, with the district group pages.
    Old `/branches?group=…` links redirect there; the group cards are links. In the sitemap via
    `branchGroups` from `GET /api/sitemap`.
  - `FAQPage` data only where the app shows the questions too (guide, estimate). College, branch
    and group pages keep their questions as prerendered text only: structured data must describe
    what visitors see.
- **District landing pages** (`src/pages/DistrictPage.tsx`, text in `src/lib/districts.ts`): the
  hub `/engineering-colleges`, one page per district (`/engineering-colleges/pune`) and one per
  district and branch group (`/engineering-colleges/pune/computer-it`) when at least 2 colleges in
  the district have that group (`MIN_COLLEGES_PER_GROUP_PAGE`). Slugs come from `slugify` in
  `@mhtcet/core`. Each lists colleges or branches by open-seat closing merit number, lowest first,
  with the FRA-approved fee and NIRF median salary only where published. Data from
  `GET /api/districts` and `/api/districts/:slug`; prerendered (`CollectionPage`, `ItemList`,
  `BreadcrumbList`) and in the sitemap. 192 pages on the 2026 data.
- **Home page** (`homePage` in `scripts/prerender.ts`): `index.html` is prerendered with its own
  canonical URL, a heading, how it works, the 20 most sought-after colleges, Computer & IT pages for
  the six largest districts and every district page (about 660 words, 65 links on the 2026 data).
  The empty app shell is `app.html` (a copy of the built `index.html`, written by the `app-shell`
  plugin in `vite.config.ts`): app-only routes are served it, and the service worker uses it as its
  page-load fallback. The service worker never answers page loads of files (`/sitemap.xml`,
  `/robots.txt`) or `/api/`.
- **Share image**: `public/og-image.png` (1200 × 630) on every prerendered page (`og:image`, size,
  alt text, `twitter:image`, `summary_large_image`). Source `scripts/og-image.html`; regenerate with
  `node scripts/og-image.mjs` and commit the PNG.
- **One public address**: the production site also answers on `*.up.railway.app`; the app sends
  those visits to the same page on `VITE_SITE_URL` (`publicAddressRedirect` in `src/lib/seo.ts`).
  It's a JavaScript redirect (the static host can't send a 301 by host name); every prerendered page
  also names its canonical URL. `www.getmecollege.com` has no DNS record yet: add one and redirect it
  to `getmecollege.com` at the DNS provider.
- **Routing** comes from `dist/serve.json`, not `serve -s` (which sent every URL to `index.html`
  and hid the prerendered files): prerendered URLs are served from their own file, app-only routes
  (`APP_ONLY_ROUTES` in `scripts/prerender.ts`) get `app.html`, and any other URL gets
  `404.html` (the app, which shows "not found") with a real 404 status. A unit test checks every
  route in `App.tsx` is covered. Start the web service with `npx serve apps/web/dist -l $PORT`
  (no `-s`).

**Not yet**
- `Dataset` / `FAQPage` structured data.
- Lighthouse SEO and speed checks in CI.

**At the production rollout** (also in `production-rollout.md`): set `VITE_SITE_URL` on the
production web service, start it without `-s`, check `https://getmecollege.com/robots.txt`,
`/sitemap.xml` and a college page's page source, and submit the sitemap in Google Search Console.
