# Production Readiness and Parity Checklist

This checklist is the release gate for shipping InfiniStar as a reliable and commercially viable AI chat product.

## 1. Automated Quality Gate

- [x] `npm run format:check`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test -- --runInBand`
- [x] `npm run build`
- [x] `npm run test:e2e -- --reporter=line` (10 passed, 0 skipped in default/public suite)
- [x] `npm run test:e2e:auth -- --reporter=line` (3 passed auth UI baseline)
- [ ] Credentialed auth E2E suites with `E2E_TEST_EMAIL` + `E2E_TEST_PASSWORD` (attempted on 2026-02-20 with provided credentials; 22 suites executed but authenticated login failed, yielding 19 failures and 3 auth-page baseline passes; root cause validated in production as Clerk dev-browser handshake loop from test/dev keys)
- [x] `npm run test:load:smoke -- --base-url=http://localhost:3100 --endpoints=/,/pricing`
- [x] `npm run ci:release:gate` available for local/CI execution

## 2. Core Product Features

- [x] Authenticated chat, message persistence, and conversation management
- [x] AI generation endpoints with moderation guardrails
- [x] Explore + feed discovery experiences
- [x] Moderation reporting API with reviewer update flow (`PATCH /api/moderation/reports`)
- [x] Creator monetization primitives (tips, subscriptions, summary APIs)
- [x] Affiliate links and analytics aggregation APIs
- [x] Optional AdSense units with environment-based feature flags

## 3. Security and Compliance Baseline

- [x] CSRF verification on write endpoints
- [x] Global security headers in Next config
- [x] Auth checks on restricted analytics and creator endpoints
- [x] CSP policy implemented with override/report-only controls
- [x] Secrets rotation runbook documented (`runbooks/SECRETS_ROTATION_RUNBOOK.md`)

## 4. Commercial Validation

- [x] Affiliate click tracking persisted and queryable
- [x] Creator support flows exposed via API + UI
- [x] Stripe webhooks verified in production (`2026-02-20`: valid signatures accepted and invalid signatures rejected at `https://infini-star.vercel.app/api/webhooks/stripe` after correcting `STRIPE_WEBHOOK_SECRET` + redeploy)
- [ ] Revenue dashboard with weekly MRR/churn reporting in ops cadence

## 5. Operational Readiness

- [ ] Redis configured for production (`REDIS_URL`) so rate limiting and 2FA token storage work across instances (validated locally on 2026-02-20 with `REDIS_URL=redis://127.0.0.1:6379` + local Postgres: `/api/health` returned `200` with `{\"database\":\"connected\",\"redis\":\"connected\"}`; Vercel Upstash install attempted on 2026-02-20 but blocked until marketplace terms acceptance in dashboard)
- [x] Sentry alert rules verified against production severity thresholds (passed on 2026-02-20 after creating `Critical/P0 issue alert`; audit now reports 2 active rules, 2 with actions, and 1 critical/P0)
- [ ] Clerk + Stripe production live-mode keys configured (production currently uses Clerk test/dev instance and Stripe test keys; live key rotation pending)
- [x] Incident response runbook documented (`runbooks/INCIDENT_RESPONSE_RUNBOOK.md`)
- [x] DB backup/restore drill executed and documented (passed on 2026-02-20 via Dockerized Postgres tooling: backup + restore to isolated `infinistar_ci_drill`, 21 public tables restored)
- [x] Canary deployment + rollback runbook documented (`runbooks/CANARY_DEPLOYMENT_ROLLBACK.md`)

## Recommended Run Order

1. `npm run ci:release:gate`
2. `RUN_E2E=1 npm run ci:release:gate`
3. Start app and run `RUN_LOAD_SMOKE=1 npm run ci:release:gate`
4. Verify Stripe webhook behavior in staging: `npm run ops:stripe:webhook:verify`
5. Audit Sentry issue alert rules: `npm run ops:sentry:alerts:audit`
6. Execute DB drill in isolated environment: `npm run ops:db:backup-restore:drill`
7. Close remaining unchecked items above before production launch
