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

1. Apply the migrations in timestamp order: `supabase/migrations/20261023084218_wortin_vocabulary_schema.sql`, then `supabase/migrations/20261025065829_user_progress_security.sql`.
2. Import the source data into `public.vocabulary` (the linked project already contains the 3,400-word dataset).
3. Keep anonymous vocabulary access read-only. The `public.vocabulary` table uses RLS with a public SELECT policy; do not add anonymous write policies.
4. Signed-in progress is stored in `public.user_progress`. RLS must restrict SELECT, INSERT and UPDATE to rows where `auth.uid() = user_id`; anonymous/public access is revoked by the security migration.
5. The browser uses a Supabase **publishable** key. It is designed to be public; never put a service-role or `sb_secret_...` key in client code.

The migrations are repeatable for the intended schema baseline. Review changes before applying them to an existing production project.

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
- Supabase's leaked-password protection was flagged as disabled by the security advisor during the 2026-10-27 audit. Enable it in **Authentication → Security and Protection** if the project's plan exposes the setting; do not treat this as fixed by client-side password rules.


## Checks

Run the repository's dependency-free checks with Node.js:

```sh
node --check app.js
node scripts/validate-site.cjs
node --test tests/*.test.cjs
```
