# SEO

**What's in place (2026-10-03)**
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
- **District landing pages** (`src/pages/DistrictPage.tsx`, text in `src/lib/districts.ts`): the
  hub `/engineering-colleges`, one page per district (`/engineering-colleges/pune`) and one per
  district and branch group (`/engineering-colleges/pune/computer-it`) when at least 2 colleges in
  the district have that group (`MIN_COLLEGES_PER_GROUP_PAGE`). Slugs come from `slugify` in
  `@mhtcet/core`. Each lists colleges or branches by open-seat closing merit number, lowest first,
  with the FRA-approved fee and NIRF median salary only where published. Data from
  `GET /api/districts` and `/api/districts/:slug`; prerendered (`CollectionPage`, `ItemList`,
  `BreadcrumbList`) and in the sitemap. 192 pages on the 2026 data.
- **Routing** comes from `dist/serve.json`, not `serve -s` (which sent every URL to `index.html`
  and hid the prerendered files): prerendered URLs are served from their own file, app-only routes
  (`APP_ONLY_ROUTES` in `scripts/prerender.ts`) get `index.html`, and any other URL gets
  `404.html` (the app, which shows "not found") with a real 404 status. A unit test checks every
  route in `App.tsx` is covered. Start the web service with `npx serve apps/web/dist -l $PORT`
  (no `-s`).

**Not yet**
- A share image (`og:image`): links shared on WhatsApp show no picture.
- `Dataset` / `FAQPage` structured data.
- Lighthouse SEO and speed checks in CI.

**At the production rollout** (also in `production-rollout.md`): set `VITE_SITE_URL` on the
production web service, start it without `-s`, check `https://getmecollege.com/robots.txt`,
`/sitemap.xml` and a college page's page source, and submit the sitemap in Google Search Console.
