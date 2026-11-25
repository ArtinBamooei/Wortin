# Wortin

**Wortin** is a Persian-first German vocabulary practice web app based on the supplied Goethe-Zertifikat B1 word-list dataset.

## Features

- Quiet, minimal interface with warm ivory and sage colors, generous spacing, restrained 3D artwork and light/dark themes.
- Responsive desktop, tablet and mobile layouts with comfortable mobile tap targets, readable dictionary rows, a compact five-item mobile bar with a More panel, and keyboard-visible focus states.
- Cached-first vocabulary loading with background refresh, fewer initial API requests, and lazy rendering of inactive dictionary/review/statistics views.
- Vocabulary search across German words, Persian meanings and example sentences.
- Word details, example sentences, grammar/case notes, prepositions and source page when present.
- Flashcards, a four-option meaning quiz, German text-to-speech, saved words and spaced-review scheduling with 10-minute retries, 1-day and 3-day early intervals, then gradual expansion up to 180 days.
- Personal progress, weekly activity, daily goal and mastery overview.
- Supabase as the vocabulary source; progress is cached in per-user local storage and synchronized through `public.user_progress` for signed-in users.

## Data

The imported source file contained 2,995 alphabetic entries and 405 thematic entries (3,400 total). Each record keeps its source code, section, German headword, word type, Persian meaning, source examples, extra examples, verb case/preposition notes, thematic group/equivalent, and printed PDF page where available.

The Persian meanings and grammar notes are user-supplied annotations from the source text, not independently certified by Goethe.

## Supabase setup

The app uses the Supabase **publishable** key in the browser, not a service-role key. This is appropriate only because the vocabulary table has RLS enabled and a read-only public SELECT policy. Do not add write policies for anonymous visitors or expose any service/secret key in `index.html`.

1. Apply the migrations in timestamp order: `supabase/migrations/20261023084218_wortin_vocabulary_schema.sql`, `supabase/migrations/20261025065829_user_progress_security.sql`, `supabase/migrations/20261119104740_security_hardening_public_table_grants.sql`, `supabase/migrations/20261125115143_user_progress_integrity.sql`, then `supabase/migrations/20261125115228_validate_user_progress_integrity_constraints.sql`.
2. Import the source data into `public.vocabulary` (the linked project already contains the 3,400-word dataset).
3. The least-privilege grants migration keeps vocabulary read-only for visitors and restricts user progress to authenticated users.
4. Apply the two November 25 migrations to enforce bounded JSON object/array shapes, 2 MiB / 512 KiB payload limits, server-side `updated_at`, and an owner-only DELETE policy. The second migration validates the constraints against existing rows.
5. Keep anonymous vocabulary access read-only. The `public.vocabulary` table uses RLS with a public SELECT policy; do not add anonymous write policies.
5. Signed-in progress is stored in `public.user_progress`. RLS must restrict SELECT, INSERT and UPDATE to rows where `auth.uid() = user_id`; anonymous/public access is revoked by the security migration.
6. The browser uses a Supabase **publishable** key. It is designed to be public; never put a service-role or `sb_secret_...` key in client code.

The migrations are repeatable for the intended schema baseline. Review changes before applying them to an existing production project.

### Security hardening audit (2026-11-19)

- `public.vocabulary`: RLS enabled; `anon` and `authenticated` have SELECT only. INSERT, UPDATE, DELETE and TRUNCATE are revoked.
- `public.user_progress`: RLS and FORCE RLS enabled; only `authenticated` has SELECT, INSERT, UPDATE and DELETE. Every policy binds access to `auth.uid() = user_id`; anonymous access is revoked.
- `progress` and `daily` JSONB payloads have validated object/array shape constraints and hard byte-size limits. A database trigger sets `updated_at` from server time.
- No public views or `SECURITY DEFINER` functions were found in the exposed `public` schema. No tables were found in the `supabase_realtime` publication.
- Browser source uses only the Supabase publishable key. Never replace it with a service-role or secret key.
- The site CSP blocks inline scripts, `eval`, objects and unapproved frames. Inline styles remain allowed because the current UI uses inline style attributes.
- The auth redirect is pinned to the canonical GitHub Pages URL. Third-party Aparat embeds are host-validated and sandboxed.
- GitHub Pages does not provide configurable response headers for this static deployment. The HTML meta CSP and referrer policy do not replace HSTS, `X-Content-Type-Options`, `Permissions-Policy`, or `frame-ancestors` response headers. A CDN or custom host with response-header rules is required to enforce them.
- Supabase Security Advisor reports `Leaked Password Protection Disabled`. Enable it under **Authentication → Sign In / Providers → Email → Prevent use of leaked passwords** if the plan supports it. This is a server-side setting and cannot be enforced by frontend validation.


## Publish with GitHub Pages

In the repository, open **Settings → Pages** and select **GitHub Actions** under Build and deployment. Save. The workflow runs JavaScript syntax checks, security/source validation and automated learning-logic tests before deploying the static site. Open:

`https://artinbamooei.github.io/Wortin/`

If the Pages deployment is already enabled, a push to `main` should trigger a rebuild.

## Local preview

Open `index.html` in a local static web server (recommended) or publish it with GitHub Pages. The app has no build step or frontend framework requirement; its only runtime backend dependency is the Supabase Data API.

## Keyboard shortcuts

- `Ctrl/Cmd + K`: global word search.
- `Enter` or `Space` while a flashcard is focused: flip between the word and its meaning.
- Use the three on-card controls to rate a word; numeric rating shortcuts are not enabled.

## Notes

- The interface is Persian-first and the German sentences render left-to-right.
- Browser speech synthesis availability depends on the user's browser and installed German voice.
- Reduced-motion preferences are respected.
- Account registration and login use Supabase Auth. Anonymous learning progress stays on that browser; signed-in users sync progress through the user-owned `user_progress` table.
- Browser security depends on the deployed CSP plus RLS in Supabase; the publishable key is not a substitute for row-level access policies.
- Supabase's leaked-password protection was flagged as disabled by the security advisor in the 2026-11-17 audit. The setting is under **Authentication → Sign In / Providers → Email → Prevent use of leaked passwords** and is available on Supabase Pro and above. On lower plans, retain strong server-side minimum-length and character requirements where available; client-side validation alone is not an equivalent server-side control. Re-run the Security Advisor after changing Auth settings.


## Checks

Run the repository's dependency-free checks with Node.js:

```sh
node --check app.js
node scripts/validate-site.cjs
node --test tests/*.test.cjs
```
