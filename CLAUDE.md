# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InfiniStar is an AI chatbot application built with Next.js 16 (App Router), featuring subscription-based access via Stripe, real-time messaging with Pusher, and a conversational interface. The application uses Postgres (Neon) for data persistence via Prisma ORM and Clerk for authentication.

**Key Features:**

- AI-powered conversations with Claude (Anthropic)
- Real-time messaging with Pusher
- Message editing and deletion (soft delete)
- Message reactions and reply/threading support
- Conversation archiving (per-user archive status)
- Conversation pinning (per-user pin status, max 5 pins)
- Conversation muting (per-user mute status)
- Conversation sharing (public links and invite-only)
- Conversation export (JSON, Markdown, plain text)
- **Auto-delete conversations** (per-user settings with configurable retention periods)
- AI memory persistence across conversations
- Custom AI characters (user-created and public marketplace)
- Message templates with shortcuts
- Conversation tagging and organization
- Advanced search across conversations and messages
- User presence tracking (online/offline/away)
- GDPR-compliant account deletion with 30-day grace period
- Stripe subscription management (free and PRO tiers)
- Comprehensive security features (CSRF, rate limiting, input sanitization)
- Multiple AI personalities and model selection
- Token usage tracking and cost estimation
- Sentry error monitoring integration
- Comprehensive accessibility (ARIA labels, keyboard navigation)

## Development Commands

```bash
# Development
bun run dev              # Start development server on localhost:3000
bun run build            # Build for production
bun run start            # Start production server
bun run preview          # Build and start production server

# Code Quality
bun run lint             # Run ESLint
bun run lint:fix         # Fix ESLint errors automatically
bun run typecheck        # Run TypeScript type checking (no emit)
bun run format:write     # Format code with Prettier
bun run format:check     # Check code formatting

# Testing
# IMPORTANT: Use `bun run test` (Jest — what CI runs). Do NOT use `bun test`: Bun's own
# test runner lacks jest.resetModules()/jest.requireMock()/jsdom and reports dozens of
# FALSE failures in suites that pass under Jest.
# Load CI env first so env validation passes: set -a; source .env.ci.example; set +a
bun run test --runInBand                         # Run all unit tests (Jest, CI parity)
bun run test app/__tests__/lib/sanitize.test.ts  # Run a single test file
bun run test -t "sanitizeMessage"                # Run tests matching a pattern
bun run test:e2e             # Run Playwright E2E tests
bun run test:e2e:ui          # Run E2E tests with Playwright UI
bun run test:e2e:headed      # Run E2E tests in headed browser

# Database
npx prisma generate      # Generate Prisma Client
npx prisma db push       # Push schema changes to database (development)
npx prisma studio        # Open Prisma Studio to view/edit data
npx prisma migrate deploy  # Apply pending migrations in production (NOT dev)
bun run migrate:deploy     # Shorthand for the above
# WARNING: Production: always use `migrate:deploy`, never `db push`
bun run seed             # Seed database with test data
```

## Architecture

### Next.js App Router Structure

The project uses Next.js 16 App Router with route groups:

- `app/(auth)/` - Authentication pages (Clerk sign-in and sign-up)
  - `sign-in/[[...sign-in]]/` - Clerk sign-in page
  - `sign-up/[[...sign-up]]/` - Clerk sign-up page
- `app/(dashboard)/dashboard/` - Protected dashboard routes
  - `conversations/` - Conversation list and individual conversation views
  - `conversations/[conversationId]/` - Dynamic conversation detail pages
  - `characters/` - Character management (list, create, detail)
  - `favorites/` - Favorite characters page
  - `profile/` - User profile and settings
  - `usage/` - AI usage statistics and analytics
- `app/(marketing)/` - Public marketing pages (landing, pricing, explore, characters, creators)
- `app/(docs)/` - Legal pages (privacy policy, terms of service)

### Where things live

- `app/actions/` - server-side data fetching (`getCurrentUser`, `getConversations`, `getMessages`, `createAIConversation`, characters)
- `app/api/` - REST routes: `conversations/*`, `messages/*`, `characters/*`, `profile/`, `webhooks/{clerk,stripe}/`, `cron/*`, `csrf/`, `health/`
- `app/lib/` - shared utilities: `prismadb.ts`, `api-client.ts`, `csrf.ts`, `rate-limit.ts`, `sanitize.ts`, `ai.ts`, `pusher.ts`, `stripe.ts`
- `app/components/` - shared UI; route-local components sit next to their route under `components/`
- `prisma/schema.prisma` - data model (UUID ids, `@db.Uuid`); migrations in `prisma/migrations/`
- `env.mjs` - typed env schema (`@t3-oss/env-nextjs`); `.env.template` lists every variable
- `app/__tests__/` - Jest unit tests; `tests/` - integration (Postgres); `e2e/` - Playwright

Read the schema, `env.mjs`, and the route you are touching before changing behaviour; the code is the source of truth.

## Important Notes

- **Test UUIDs**: Zod v4 (`^4.3.6`) enforces strict RFC 4122 UUID validation. In tests, use UUIDs with valid version digit (3rd group must start `1`–`5`) and valid variant bits (4th group must start `8`, `9`, `a`, or `b`). Example that works: `11111111-1111-4111-8111-111111111111`. Example that fails: `11111111-1111-1111-1111-111111111111`.
- **Prisma Client**: Use the singleton instance from `app/lib/prismadb.ts`. It exports both `default` (as `prisma`) and named `db` export. Uses Neon adapter (`@prisma/adapter-neon`) with WebSocket support.
- **No `app/libs/` directory**: Only `app/lib/` exists. All utility files are in `app/lib/`.
- **Route Groups**: Parentheses in directory names like `(dashboard)` are Next.js route groups - they don't appear in URLs
- **UUIDs**: All IDs are UUIDs, use `@db.Uuid` in Prisma schema
- **Real-time**: Pusher channel naming follows pattern: `conversation-${conversationId}` and `user-${userId}`
- **Type Safety**: The project uses TypeScript strictly - always run `bun run typecheck` before committing
- **API Client**: Always use the centralized API client (`app/lib/api-client.ts`) for frontend API requests instead of raw axios
- **Authentication**: Clerk handles the primary auth flows (sign-in, sign-up, email verification, password reset, OAuth, MFA). Clerk's Frontend API is proxied through `app/api/clerk-proxy/` (Clerk proxy mode).
- **Fallback auth (deliberate, keep it off)**: A second auth path — bcrypt-hashed backup passwords and cookie sessions — lives behind the `ENABLE_FALLBACK_AUTH` flag (`app/lib/fallback-auth.ts`, `app/api/auth/fallback/*`). It exists as a hedge for a Clerk outage and is **off by default**: the flag must be explicitly set to `1`/`true`/`yes`/`on`, and all three mutation routes (sign-in, sign-up, sign-out) re-check it server-side, so the endpoints are inert while it is unset.

  This is a conscious trade-off — a second credential store is real duplicate surface, accepted to avoid a hard dependency on one auth provider. Rules for working with it:
  - Leave it **off** in normal operation. It is for an outage, not a feature.
  - Never gate it in the UI alone; the server-side check in each route is what makes it safe.
  - Before ever enabling it in production, confirm `REDIS_URL` is set (sessions and rate limits must be shared across instances) and plan to turn it back off once Clerk recovers.
  - Any change here needs the same scrutiny as the primary auth path, including the rate limiting on the sign-in/sign-up routes.

- **Development Emails**: In development mode, emails are logged to console instead of being sent via Postmark
- **Rate Limiting**: Redis-backed when `REDIS_URL` is set (see `app/lib/redis-rate-limiter.ts`); in-memory fallback otherwise. Set `REDIS_URL` for any multi-instance or serverless deployment.
- **2FA Tokens**: `app/lib/two-factor-tokens.ts` uses Redis when `REDIS_URL` is set, with an in-memory fallback for development.
- **CSRF Protection**: All POST/PUT/PATCH/DELETE endpoints should validate CSRF tokens via `app/lib/csrf.ts`
- **AI Usage Tracking**: Free users limited to 50 AI messages per month (configurable via `AI_FREE_MONTHLY_MESSAGE_LIMIT`). Detailed per-request tracking in `AiUsage` model with token counts and cost estimation.
- **Server Actions**: Next.js 15 server actions require `'use server'` directive at the top of the file
- **Environment Setup**: See `.env.local.example` for complete setup guide; use `SETUP.md` for service configuration
- **Sentry**: Optional error monitoring via `@sentry/nextjs`. Configure with `SENTRY_*` environment variables.
- **Cron Jobs**: Two cron endpoints protected by `CRON_SECRET`: `/api/cron/auto-delete` (conversation cleanup) and `/api/cron/process-deletions` (GDPR account deletion processing)
- **Next.js Version**: Uses Next.js 16 (`next@^16.1.6`) with App Router. Note: package.json still says "Next.js 15" in some places; the actual installed version is `^16.1.6`.

## Security Best Practices

1. **Rate Limiting**: Apply to all sensitive endpoints using the appropriate limiter from `app/lib/rate-limit.ts`
2. **Input Validation**: Use Zod schemas for all request body validation
3. **CSRF Protection**: Validate tokens on all state-changing operations using `app/lib/csrf.ts`
4. **Sanitization**: Use `sanitizeMessage()` from `app/lib/sanitize.ts` for user messages before storage. The sanitize library is server-safe (regex-based, no DOMPurify dependency). Additional utilities: `sanitizeHtml()`, `sanitizePlainText()`, `sanitizeUrl()`, `sanitizeFilename()`, `sanitizeEmail()`, `sanitizeObject()`.
5. **Error Messages**: Provide helpful but secure error messages that don't leak sensitive information
6. **Authentication**: Clerk handles all authentication security (password hashing, token management, email verification, MFA). Do not implement custom auth flows.
7. **Webhook Verification**: Clerk webhooks verified via `svix` library. Stripe webhooks verified via Stripe SDK.
8. **Account Deletion**: GDPR-compliant with 30-day grace period, data anonymization, and email notifications at each stage
9. **Content Moderation**: User blocking (`UserBlock` model) and content reporting (`ContentReport` model) via `/api/moderation/` endpoints
