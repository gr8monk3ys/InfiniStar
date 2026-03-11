# Deployment Guide

This project is maintained for deployment on Vercel with Bun, Clerk, Prisma/Postgres, Pusher, Stripe, and Redis.

## Production Prerequisites

- Vercel project connected to this repository
- Production Postgres database
- Production Clerk instance
- Production Pusher app
- Stripe live-mode API key, price, and webhook endpoint
- Redis instance exposed through `REDIS_URL`
- Postmark production server

Recommended:

- Sentry project and alert rules
- Scheduled review of runbooks in [`runbooks/`](runbooks/)

## Required Production Environment

Use `.env.template` as the checklist. At minimum, production should set:

```bash
NEXT_PUBLIC_APP_URL=

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
NEXT_PUBLIC_CLERK_PROXY_URL=/api/clerk-proxy
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

DATABASE_URL=
DIRECT_URL=

SMTP_FROM=
POSTMARK_API_TOKEN=
POSTMARK_SIGN_IN_TEMPLATE=
POSTMARK_ACTIVATION_TEMPLATE=

STRIPE_API_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_MONTHLY_PLAN_ID=

PUSHER_APP_ID=
PUSHER_SECRET=
NEXT_PUBLIC_PUSHER_APP_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=

CRON_SECRET=
REDIS_URL=
```

If you use AI/media features in production, also set:

```bash
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
OPENAI_MODERATION_MODEL=omni-moderation-latest
OPENAI_IMAGE_MODEL=dall-e-3
OPENAI_TRANSCRIPTION_MODEL=whisper-1
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

## Vercel Configuration

Recommended settings:

- Install command: `bun install`
- Build command: `bun run build`
- Output: Next.js default

Cron jobs are already defined in [vercel.json](vercel.json):

- `/api/cron/process-deletions`
- `/api/cron/auto-delete`

Both require `Authorization: Bearer <CRON_SECRET>`.

## External Service Checklist

### Clerk

- Use a production Clerk instance, not test/dev credentials
- Add the production domain and redirect URLs
- Set `NEXT_PUBLIC_CLERK_PROXY_URL=/api/clerk-proxy` and keep the `/api/clerk-proxy/*` route reachable on the app origin
- Configure OAuth providers in Clerk if needed
- Point the Clerk webhook to `/api/webhooks/clerk`

### Stripe

- Use live-mode secret keys and live price IDs
- Configure the webhook endpoint:
  `https://<your-domain>/api/webhooks/stripe`
- Ensure the webhook secret matches `STRIPE_WEBHOOK_SECRET`
- Re-run:

```bash
bun run ops:stripe:webhook:verify
```

### Pusher

- Add the deployed origin to the allowed origins list
- Verify the public key and cluster match the client bundle values

### Redis

- Required for production readiness
- Without Redis, rate limiting and token storage fall back to in-memory behavior
- `/api/health` returns `503 degraded` in production when Redis is missing or disconnected

### Sentry

- Set DSNs for server and client
- If uploading source maps, also set org/project/auth token values
- Audit alert coverage:

```bash
bun run ops:sentry:alerts:audit
```

## Release Gate

Run before deploy:

```bash
bun run format:check
bun run lint
bun run typecheck
bun run test --runInBand
bun run build
bun run ci:release:gate
```

Higher-confidence checks:

```bash
bun run test:e2e
bun run test:e2e:auth
bun run test:load:smoke -- --base-url=https://<your-domain>
```

## Post-Deploy Validation

1. Check `https://<your-domain>/api/health`
2. Verify Clerk auth on a real production user flow
3. Verify Stripe checkout and customer portal
4. Verify Stripe webhook processing
5. Verify Pusher real-time messaging
6. Confirm cron routes are invoked by Vercel
7. Check Sentry for startup/runtime errors

## Rollback and Incident Response

- Canary / rollback: [runbooks/CANARY_DEPLOYMENT_ROLLBACK.md](runbooks/CANARY_DEPLOYMENT_ROLLBACK.md)
- Incident response: [runbooks/INCIDENT_RESPONSE_RUNBOOK.md](runbooks/INCIDENT_RESPONSE_RUNBOOK.md)
- Secrets rotation: [runbooks/SECRETS_ROTATION_RUNBOOK.md](runbooks/SECRETS_ROTATION_RUNBOOK.md)
- DB drill: [runbooks/DB_BACKUP_RESTORE_DRILL.md](runbooks/DB_BACKUP_RESTORE_DRILL.md)
