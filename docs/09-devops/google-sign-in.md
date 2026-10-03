# Google sign-in (#15): setup and how it works

## How it works
- **Sign-in:** Supabase Auth with the Google provider (PKCE flow). The web app sends the student to
  Google and gets them back on `/signin`, which returns them to the page they started from.
- **The student's data:** table `user_store` (migration `packages/pipeline/migrations/007_user_store.sql`),
  one row per piece: `profile`, `list`, `compare`, `allotment`, `progress`. The web app reads and
  writes it with the student's own session. Row-level security allows each signed-in user only their
  own rows; signed-out visitors (`anon`) have no access at all.
- **Newest wins:** every change in the browser is stamped with its time (`compass_sync_meta_v1`). On
  sign-in, and when the tab comes back into view, each piece goes the way of the newer copy. The
  database function `put_user_item` only replaces a row with a newer one, so an older device can't
  overwrite a newer change.
- **The API is unchanged:** it never sees user data, and its database role stays read-only.
- **Sign-out** saves anything pending, then removes the synced pieces from that browser.
  **Delete data saved to my account** (My details) deletes the rows and signs out. Deleting the
  Supabase auth user itself is a manual step in the Supabase dashboard (Authentication → Users) on
  request, until an account-deletion endpoint exists.
- **Without settings** (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` empty) the app works as
  before and the sign-in page says accounts are coming soon. The e2e suite runs this way.

## One-time setup (owner)
Do this for **staging** first; repeat for production when approved.

1. **Google Cloud console** → APIs & Services → OAuth consent screen: app name "Compass", support
   email, scopes `email`, `profile`, `openid` only. Then Credentials → Create OAuth client ID →
   Web application:
   - Authorised JavaScript origins: `http://localhost:3000` and the web app's Railway URL.
   - Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
     (shown in Supabase under Authentication → Providers → Google).
2. **Supabase** → Authentication → Providers → Google: enable, paste the client ID and secret.
   Authentication → URL Configuration: Site URL = the web app's URL; Redirect URLs =
   `http://localhost:3000/signin` and `https://getmecollege.com/signin`.
3. **Database:** run `007_user_store.sql` in the Supabase SQL editor (or the pipeline's migration
   runner) on staging. It only adds `user_store` and `put_user_item`.
4. **Web app settings** (Supabase → Project Settings → API):
   - Local: create `apps/web/.env.local` with `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=`
     (git-ignored), then restart `npm run dev`.
   - Railway web service: set the same two variables; they are read at build time.
5. **Check:** sign in on one browser, add a choice, sign in on another browser: the choice appears.

The anon key is public by design (it ships in the web app); never put the `service_role` key in the
web app or in a `VITE_` variable.
