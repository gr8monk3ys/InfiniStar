# Security Overview

This document describes the current security model of the application as implemented in the codebase.

## Authentication and Route Protection

- Authentication is handled by Clerk, not NextAuth
- Route protection and auth/CORS handling are applied in [proxy.ts](proxy.ts)
- Protected dashboard routes are enforced through Clerk middleware
- Clerk webhooks are handled at `/api/webhooks/clerk`

## CSRF Protection

- Write endpoints use double-submit-cookie CSRF protection
- Server verification lives in [app/lib/csrf.ts](app/lib/csrf.ts)
- Client helpers live in [app/hooks/useCsrfToken.ts](app/hooks/useCsrfToken.ts)

## Security Headers and CSP

Global headers are applied from [next.config.mjs](next.config.mjs):

- `Content-Security-Policy` or report-only mode
- `Strict-Transport-Security`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`

The CSP can be overridden or switched to report-only mode with:

- `CONTENT_SECURITY_POLICY`
- `CONTENT_SECURITY_POLICY_REPORT_ONLY`
- `CONTENT_SECURITY_POLICY_REPORT_URI`

## CORS

- CORS headers are applied in the proxy layer
- Allowed origins are derived from runtime configuration in [app/lib/cors.ts](app/lib/cors.ts)
- Production should restrict requests to the deployed origin in `NEXT_PUBLIC_APP_URL`

## Rate Limiting

- API rate limiting is implemented in [app/lib/rate-limit.ts](app/lib/rate-limit.ts)
- Redis-backed limits are used when `REDIS_URL` is configured
- In-memory fallback exists for local development

Production requirement:

- `REDIS_URL` should be configured
- In production, missing Redis causes `/api/health` to return `503 degraded`

## Payments and Webhooks

- Stripe webhook signature verification is enforced in `/api/webhooks/stripe`
- Billing mutation routes also use auth, CSRF checks, and rate limiting
- Production webhook behavior should be validated with:

```bash
bun run ops:stripe:webhook:verify
```

## Cron Security

The cron endpoints require:

- `CRON_SECRET`
- `Authorization: Bearer <CRON_SECRET>`

Covered routes:

- `/api/cron/process-deletions`
- `/api/cron/auto-delete`
- `/api/cron/reconcile-character-comment-counts`

## Data Safety and Abuse Controls

- Input sanitization helpers live in [app/lib/sanitize.ts](app/lib/sanitize.ts)
- Moderation and safety logic live in [app/lib/moderation.ts](app/lib/moderation.ts) and [app/lib/nsfw.ts](app/lib/nsfw.ts)
- Moderation reports are managed through `/api/moderation/reports`
- Reviewer access is gated by `MODERATION_REVIEWER_EMAILS`

## Monitoring and Health

- Health endpoint: `/api/health`
- Monitoring integration: Sentry via `@sentry/nextjs`
- Alert audit script:

```bash
bun run ops:sentry:alerts:audit
```

## Operational Expectations

For a production-ready deployment, all of the following should be true:

- Redis configured and healthy
- Clerk production instance configured
- Stripe live keys and webhook configured
- CSP/header configuration reviewed
- Sentry alerts configured
- Secrets rotation and rollback runbooks reviewed

Launch gating is tracked in [PRODUCTION_PARITY_CHECKLIST.md](PRODUCTION_PARITY_CHECKLIST.md).
