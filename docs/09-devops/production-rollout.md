# Production rollout checklist

The owner's rule (2026-10-02): nothing moves to production until every open issue is finished.
Work happens on `Dev` and the **staging** Supabase project. This list collects every production
step held back, so the rollout is one pass. Add to it whenever a change needs a production step.

## Database (production Supabase project)
- [ ] Run the migrations not yet on production: `007_user_store.sql` (#15) and
      `008_lock_public_tables.sql` (row-level security on every table; Supabase's public API closed
      to the data tables). `npm run migrate` targets staging only: use the SQL editor or an
      approved run against production.
- [ ] Create the SELECT-only `compass_api` role **with its read policies** (needed because of 008)
      and use it in the API's `DATABASE_URL` (#131 O2; SQL in
      `docs/07-security/security-review-2026-09.md`). Then check the API still loads its data.
- [ ] Download the CA certificate (Project Settings → Database → SSL); set `DATABASE_CA_CERT` on the
      API service and for the pipeline (#131 O3).

## Sign-in (#15, `docs/09-devops/google-sign-in.md`)
- [ ] Google Cloud: add the production web URL to the OAuth client's JavaScript origins, and the
      production Supabase callback URL to its redirect URIs (or a separate production client).
- [ ] Google Cloud: publish the consent screen (out of Testing) so any student can sign in.
- [ ] Supabase: enable Google with the client ID and secret; set Site URL and add
      `https://<web>/signin` to Redirect URLs.
- [ ] Supabase: turn **off** Email (and Phone) sign-up (#131).
- [ ] Run `npm run check:supabase -w @mhtcet/web` with the production URL and anon key: all PASS.

## Railway
- [ ] Web service: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (build time), and `VITE_API_URL`.
- [ ] API service: `CORS_ORIGINS` = the production web URL (#131 O1), `DATABASE_URL` with the
      `compass_api` role, `DATABASE_CA_CERT`, `NODE_ENV=production`.
- [ ] After deploy: API logs show no `security_warning`; rank finder, simulator, Ask, sign-in and
      sync work on the production URL.

## SEO (`docs/09-devops/seo.md`)
- [ ] Choose the public domain (open decision in `docs/DECISIONS.md`).
- [ ] Production web service: `VITE_SITE_URL=https://<domain>` (build time). Never on staging.
- [ ] After deploy: `/robots.txt` allows crawling and lists the sitemap; `/sitemap.xml` has every
      college and branch page.
- [ ] Google Search Console: verify the domain and submit `https://<domain>/sitemap.xml`.

## Staging, before the rollout
- [x] Turn off Email sign-up on staging; `npm run check:supabase -w @mhtcet/web` all PASS (2026-10-02).
- [x] 007 and 008 applied to staging (2026-10-02); the API reads as owner and is unaffected.
- [ ] Same Railway settings on the staging services, to rehearse.
