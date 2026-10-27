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

1. Apply `supabase/migrations/20261023120000_wortin_vocabulary_schema.sql` to the Wortin project.
2. Import the source data into `public.vocabulary` (the initial dataset is already loaded in the linked project).
3. Confirm the Data API exposes `public.vocabulary` and that anonymous SELECT is permitted by RLS.
4. Keep learning progress in local storage, or add Supabase Auth and user-owned RLS policies before syncing personal progress between devices.

The schema is idempotent for the current project. It creates the base table if absent and adds all columns used by the app.

## Publish with GitHub Pages

In the repository, open **Settings → Pages** and select **GitHub Actions** under Build and deployment. Save. The included workflow validates the inline JavaScript, then deploys the static site. Open:

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
- The current build is a static learning app, not a multi-user account system.
