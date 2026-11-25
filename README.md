# TA BILL — Inspector Portal

Tour Allowance and Inspection Diary PWA for official use. React 19 + Vite +
Tailwind, with optional cloud sync backed by Supabase (Google sign-in, Postgres,
Row Level Security).

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the two values
npm run dev                  # http://localhost:3000
```

`.env.local` is ignored by git. Only the Supabase **publishable/anon** key belongs
here — never a secret/service_role key.

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

The app works fully offline without cloud env vars; the Profile page simply
hides the Google sign-in button until sync is configured.

## Supabase setup (one time)

1. Create the project, then in **SQL Editor** run
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   It creates `profiles`, `tours`, `entries`, owner-only RLS policies,
   `updated_at` triggers and an optional email allowlist.
   *Already created the schema with the old vault table?* Run
   [`0002_drop_vaults.sql`](supabase/migrations/0002_drop_vaults.sql) once to
   remove it.
2. **Authentication → Sign In / Providers → Google**: paste your Google Cloud
   OAuth **Client ID** and **Client Secret**. Authorized redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback`.
3. **Authentication → URL Configuration**: Site URL `https://tabill.pages.dev`,
   redirect allow list `http://localhost:3000,https://tabill.pages.dev`.
4. **Google Cloud → Google Auth Platform → Audience**: set the publishing
   status to **In production**. While it is **Testing**, only listed test users
   can sign in. Add `tabill.pages.dev` as an authorized domain and point the
   home page / privacy policy links at the deployed site.
5. Signups are **open**: anyone with a Google account can sign in and gets their
   own private rows (RLS scopes everything to `auth.uid()`). To lock the app
   down again, disable **"Allow new users to sign up"** in
   **Authentication → Sign In / Providers**, and/or insert the allowed addresses
   into `public.allowed_emails` — the trigger then rejects everyone else.

## Data model

- Local state is the source of truth for the UI (`localStorage`) and keeps
  working offline.
- On sign-in the app pulls, merges per entry (last-write-wins by `updated_at`),
  then pushes. Deletes are tombstones (`deleted_at`).
- The CBS / DMS / HRMS / ELEARNING logins sync with your Google account as part
  of the profile row (plain JSON, protected only by row-level security).
- **Profile page** (avatar in the header) holds the Google sign in/out controls
  and a **Sync now** button with the current sync status.

## Deploy (Cloudflare Pages)

Live at **https://tabill.pages.dev** (Cloudflare Pages project `tabill`, account
`sandeepsuryab@gmail.com`).

Direct upload from your machine:

```bash
npm run build
npx wrangler pages deploy dist --project-name tabill --branch main
```

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are read from `.env.local` at
  build time and inlined into the bundle (publishable key only — never a
  `service_role` key). Set them in the Pages project settings too if you switch
  to Git connected builds.
- `wrangler.jsonc` supplies the SPA fallback (`not_found_handling`), so no
  `_redirects` file is needed.
- The service worker only registers in production builds; in `npm run dev` any
  existing registration is removed so stale cached modules never break HMR.

## Scripts

```bash
npm run dev      # development server
npm run build    # production build -> dist/
npm run preview  # preview the production build
npx tsc --noEmit # type check
```
