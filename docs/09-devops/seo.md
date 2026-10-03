# SEO

**What's in place (2026-10-02)**
- Every page sets its own title, description, canonical URL and share-preview tags
  (`apps/web/src/lib/seo.ts`, `usePageMeta`). College and branch pages build them from the data:
  name, district, number of branches, years. Wording follows the copy rules: past closing ranks,
  never "you can get".
- Personal or state-dependent pages carry `noindex`: Find colleges results, option form, Add
  options, Compare, Ask, My account, My details, sign-in, simulator, after allotment, export, family
  summary, onboarding. So do missing colleges and branches.
- `robots.txt` and `sitemap.xml` are written by the web build (`scripts/write-seo-files.mjs`):
  - without `VITE_SITE_URL` (local, staging, previews): `robots.txt` blocks every crawler, no sitemap;
  - with it (production only): crawling allowed except `/summary` (its links carry a student's
    details), and a sitemap of the public pages plus every college and branch page with cutoffs
    (2,728 URLs on the 2026 data), from the API's `GET /api/sitemap`. The build fails if that call
    fails, rather than shipping without a sitemap.

**Not yet**
- Pages are rendered in the browser. Google runs the JavaScript, but slower; link previews
  (WhatsApp, LinkedIn) and many AI crawlers only see `index.html`'s defaults. Next step: pre-render
  the public pages at build time.
- Structured data (`CollegeOrUniversity`, `Dataset`, `FAQPage`).
- Lighthouse SEO and speed checks in CI.

**At the production rollout** (also in `production-rollout.md`): choose the domain, set
`VITE_SITE_URL` on the production web service, check `https://getmecollege.com/robots.txt` and
`/sitemap.xml`, and submit the sitemap in Google Search Console.
