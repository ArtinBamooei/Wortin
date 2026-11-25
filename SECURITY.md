# Security Policy

## Supported deployment

Security fixes are applied to the current default branch. Older snapshots are not guaranteed to receive fixes.

## Reporting a vulnerability

Do not publish exploitable details in a public issue or discussion. Use GitHub's private vulnerability reporting flow for this repository:

1. Open the repository's **Security** tab.
2. Select **Advisories**.
3. Choose **Report a vulnerability** and include reproduction steps, affected files, impact, and any safe proof of concept.

If private vulnerability reporting is unavailable, contact the repository owner privately through GitHub before disclosing details publicly.

## Security boundaries

- Never commit Supabase service-role or secret keys. Browser code may contain only a publishable key.
- Keep RLS enabled on every exposed table.
- Keep the user_progress policies scoped to auth.uid() = user_id.
- Do not cache authenticated API responses or session tokens in the service worker.
- Review GitHub Actions permissions and pinned action revisions before changing deployment workflows.
