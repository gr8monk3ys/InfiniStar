# InfiniStar

InfiniStar is a Next.js 16 application for AI chat, creator discovery, subscriptions, and real-time messaging. The stack is centered on Clerk for authentication, Prisma + Postgres for data, Pusher for live updates, Stripe for billing, and Bun for local development and CI.

Production launch status is tracked in [PRODUCTION_PARITY_CHECKLIST.md](PRODUCTION_PARITY_CHECKLIST.md).

## Core Features

- AI chat and streaming responses
- Real-time messaging with Pusher
- Creator profiles, follows, tips, and subscriptions
- Character discovery across explore and feed surfaces
- Moderation reporting and safety preferences
- Stripe checkout, billing portal, and webhook processing
- Operational tooling for release gates, webhook verification, Sentry audits, and DB drills

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Prisma + Postgres
- Clerk
- Stripe
- Pusher
- Tailwind CSS + Radix UI
- Bun

## Quick Start

```bash
git clone https://github.com/gr8monk3ys/InfiniStar.git
cd InfiniStar
bun install
cp .env.template .env.local
```

Fill in `.env.local`, then run:

```bash
bunx prisma migrate dev
bun run dev
```

Open `http://localhost:3000`.

## Core Commands

```bash
bun run dev
bun run build
bun run start
bun run lint
bun run typecheck
bun run test --runInBand
bun run test:e2e
bun run ci:release:gate
```

## Documentation

- [SETUP.md](SETUP.md): local setup and environment configuration
- [DEPLOYMENT.md](DEPLOYMENT.md): production deployment checklist and service setup
- [SECURITY.md](SECURITY.md): current security model and operational requirements
- [PRODUCTION_PARITY_CHECKLIST.md](PRODUCTION_PARITY_CHECKLIST.md): launch gate and remaining blockers
- [runbooks/](runbooks/): operational runbooks for incidents, rollback, secrets, Stripe, Sentry, and DB drills
- [CLAUDE.md](CLAUDE.md): internal architecture notes and agent-facing project context

## Notes

- Bun is the canonical package manager for this repo.
- `REDIS_URL` is optional for local development but required for horizontally safe production rate limiting and token storage.
- Clerk handles email/password, OAuth providers, MFA, and hosted auth flows from the Clerk dashboard.
