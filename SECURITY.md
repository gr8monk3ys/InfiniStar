# Security

To report a vulnerability, open a private security advisory on GitHub (Security → Advisories → Report) or email the maintainer. Do not open a public issue.

Auth is Clerk; write endpoints require a double-submit CSRF token (`app/lib/csrf.ts`); Stripe and Clerk webhooks are signature-verified. Security headers and CSP live in `next.config.mjs`.
