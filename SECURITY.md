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

## Deployment and authentication limitations

GitHub Pages does not provide repository-controlled response-header configuration. The current meta CSP cannot enforce `frame-ancestors`, HSTS, or `X-Content-Type-Options`. Use a host/CDN with response-header rules if those controls are required.

The Supabase Auth setting for leaked-password protection is separate from SQL/RLS and must be enabled in the Supabase Dashboard when supported by the project plan. The browser Supabase SDK is pinned to a specific CDN version; its script currently has no verified Subresource Integrity hash.

The current CSP permits inline styles because some chart and progress visuals use generated style attributes. Do not add executable inline scripts; structured-data JSON-LD is the only non-executable inline script block.
