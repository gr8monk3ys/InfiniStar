# Setup Guide

This guide reflects the current app: Next.js 16, Bun, Clerk auth, Prisma/Postgres, Pusher, Stripe, and optional Redis/Sentry/OpenAI/Anthropic integrations.

## Prerequisites

- Bun 1.3+
- Node.js 20+ available on the machine
- Postgres database
- Clerk application
- Pusher Channels app
- Stripe account
- Postmark server

Optional but recommended:

- Redis for distributed rate limiting
- Sentry for production monitoring
- Anthropic for AI chat
- OpenAI for moderation, image generation, and transcription
- Cloudinary for uploads
- Web Push VAPID keys for browser notifications

## 1. Install

```bash
git clone https://github.com/gr8monk3ys/InfiniStar.git
cd InfiniStar
bun install
```

## 2. Configure Environment

Use `.env.template` as the source of truth:

```bash
cp .env.template .env.local
```

Minimum local variables to boot the app:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

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
NEXT_PUBLIC_PUSHER_CLUSTER=us2
```

Feature-specific variables:

- `ANTHROPIC_API_KEY`: AI chat responses
- `OPENAI_API_KEY`, `OPENAI_MODERATION_MODEL`, `OPENAI_IMAGE_MODEL`, `OPENAI_TRANSCRIPTION_MODEL`: moderation, image generation, transcription
- `REDIS_URL`: distributed rate limiting and token storage
- `SENTRY_*` and `NEXT_PUBLIC_SENTRY_DSN`: monitoring and source maps
- `NEXT_PUBLIC_CLOUDINARY_*`: uploads
- `VAPID_*`: browser push notifications
- `CRON_SECRET`: required outside local development for cron endpoints

For build-only CI environments, use `.env.ci.example` and:

```bash
bun run ci:build
```

## 3. Database

```bash
bunx prisma generate
bunx prisma migrate dev
```

Optional:

```bash
bun run seed
bunx prisma studio
```

## 4. Run Locally

```bash
bun run dev
```

Visit `http://localhost:3000`.

## 5. Service Notes

### Clerk

- Configure sign-in and sign-up routes as `/sign-in` and `/sign-up`
- Add your local and production domains in the Clerk dashboard
- Configure OAuth providers inside Clerk if you want Google/GitHub/etc.
- Set the Clerk webhook secret if you want `/api/webhooks/clerk`

### Stripe

- Create the PRO monthly price and set `STRIPE_PRO_MONTHLY_PLAN_ID`
- For local webhook testing:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

- Optional local verification:

```bash
bun run ops:stripe:webhook:verify -- --url=http://localhost:3000/api/webhooks/stripe
```

### Pusher

- Create a Channels app
- Set app id, secret, public key, and cluster
- Add local and production origins in the Pusher dashboard

### Redis

- Local development can run without Redis
- Production should not: `/api/health` reports `503 degraded` in production if Redis is missing or unavailable

### Sentry

- Set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`
- Add `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` if you want release/source map uploads
- Audit alerts with:

```bash
bun run ops:sentry:alerts:audit
```

## Verification

Run these before opening a PR:

```bash
bun run format:check
bun run lint
bun run typecheck
bun run test --runInBand
bun run build
```

Optional higher-signal checks:

```bash
bun run test:e2e
bun run ci:release:gate
bun run test:e2e:auth
bun run test:e2e:redirects
```

## Troubleshooting

### Environment validation fails

- Compare `.env.local` against `.env.template`
- Use `.env.ci.example` only for build-only CI, never for real runtime environments

### Auth redirect loops in local E2E

- `test:e2e:redirects` requires a real Clerk configuration
- The redirect suite intentionally disables `SKIP_CLERK_AUTH_HANDSHAKE`

### Build succeeds but production health is degraded

- Check `/api/health`
- In production, missing Redis results in `503`
- Verify Postgres connectivity and `REDIS_URL`

### Billing issues

- Confirm `STRIPE_PRO_MONTHLY_PLAN_ID`
- Confirm the Stripe webhook endpoint and signing secret match
- Run `bun run ops:stripe:webhook:verify` against the target environment
