# Production Readiness Checklist

Last reviewed: March 8, 2026

This file is the launch gate for shipping InfiniStar as a production product.

## Verified on March 8, 2026

- [x] `bun run format:check`
- [x] `bun run lint`
- [x] `bun run typecheck`
- [x] `bun run test --runInBand` (`56/56` suites, `677/677` tests)
- [x] `bun run build`
- [x] Next 16 proxy convention adopted (`proxy.ts`)
- [x] Root metadata now sets `metadataBase`
- [x] Unit tests exit cleanly without `--forceExit`

## Product Surface

- [x] Authenticated chat and conversation management
- [x] AI chat, regeneration, image generation, and transcription endpoints
- [x] Creator profiles, follows, tips, subscriptions, and summary APIs
- [x] Explore/feed discovery and public character pages
- [x] Moderation reporting and reviewer flows
- [x] Affiliate links and summary reporting

## Security and Runtime Baseline

- [x] Clerk-based auth and protected dashboard routing
- [x] CSRF checks on mutation routes
- [x] Global security headers and CSP
- [x] Stripe webhook signature verification
- [x] Cron endpoints protected by `CRON_SECRET`
- [x] `/api/health` reports degraded status when critical dependencies are unavailable

## Operational Readiness

- [ ] Redis configured in production via `REDIS_URL`
- [ ] Clerk production instance configured with live production credentials
- [ ] Stripe live secret, live price id, and production webhook configured
- [ ] Credentialed auth E2E suite passing with real production-like credentials
- [ ] Load smoke executed against the deployed environment
- [ ] Sentry alerts verified for the production project
- [ ] Backup/restore drill rerun against the current production schema

## Documentation State

- [x] README reflects Bun + Clerk + Next.js 16
- [x] SETUP guide reflects current environment and service requirements
- [x] DEPLOYMENT guide reflects the maintained Vercel deployment path
- [x] SECURITY guide reflects the current auth/CORS/CSRF/runtime model
- [ ] Historical docs such as `MIGRATION.md`, `FIXES_SUMMARY.md`, and older planning notes still need archival cleanup or explicit labeling

## Recommended Release Order

1. `bun run ci:release:gate`
2. `bun run test:e2e`
3. `bun run test:e2e:auth`
4. `bun run test:load:smoke -- --base-url=https://<your-domain>`
5. `bun run ops:stripe:webhook:verify`
6. `bun run ops:sentry:alerts:audit`
7. Confirm `/api/health` is healthy in production
8. Close every unchecked item above before launch
