# InfiniStar Setup Guide

This guide will help you set up and run InfiniStar, an AI chatbot application with real-time messaging and subscription features.

## Prerequisites

- Node.js 18+ and Bun
- Postgres database (Neon recommended)
- Accounts for:
  - GitHub OAuth (optional)
  - Google OAuth (optional)
  - Pusher (for real-time features)
  - Stripe (for subscriptions)
  - Postmark (for emails)

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd InfiniStar
bun install
```

The `postinstall` script will automatically run `prisma generate`.

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

**Important:** The `.env.local` file is gitignored and will never be committed. This is where you put your real credentials.

Edit `.env.local` with your credentials:

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-with: openssl rand -base64 32>

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>
GITHUB_ACCESS_TOKEN=<your-github-token>

# Google OAuth (optional)
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# Database (Postgres / Neon)
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"

# Email (Postmark)
SMTP_FROM=noreply@yourdomain.com
POSTMARK_API_TOKEN=<your-postmark-token>
POSTMARK_SIGN_IN_TEMPLATE=<template-id>
POSTMARK_ACTIVATION_TEMPLATE=<template-id>

# Subscriptions (Stripe)
STRIPE_API_KEY=<your-stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>
STRIPE_PRO_MONTHLY_PLAN_ID=<your-stripe-price-id>

# Real-time (Pusher)
PUSHER_APP_ID=<your-pusher-app-id>
PUSHER_SECRET=<your-pusher-secret>
NEXT_PUBLIC_PUSHER_APP_KEY=<your-pusher-key>
NEXT_PUBLIC_PUSHER_CLUSTER=us2

# AI (Anthropic Claude)
ANTHROPIC_API_KEY=<your-anthropic-api-key>
```

### 3. Database Setup

Create and apply migrations:

```bash
bunx prisma migrate dev
```

(Optional) Open Prisma Studio to view your database:

```bash
bunx prisma studio
```

### 4. Run Development Server

```bash
bun run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Service Setup Guides

### Neon (Postgres)

1. Go to [neon.tech](https://neon.tech)
2. Create a project and database
3. Copy the pooled connection string → `DATABASE_URL`
4. Copy the direct connection string → `DIRECT_URL`

### Pusher (Real-time Features)

1. Sign up at [pusher.com](https://pusher.com)
2. Create a new Channels app
3. Get your credentials from "App Keys"
4. Add to `.env.local`:
   - App ID → `PUSHER_APP_ID`
   - Key → `NEXT_PUBLIC_PUSHER_APP_KEY`
   - Secret → `PUSHER_SECRET`
   - Cluster → `NEXT_PUBLIC_PUSHER_CLUSTER`

### Stripe (Subscriptions)

1. Sign up at [stripe.com](https://stripe.com)
2. Get your test API keys from Dashboard → Developers → API keys
3. Create a product and price in Dashboard → Products
4. Add to `.env.local`:
   - Secret key → `STRIPE_API_KEY`
   - Price ID → `STRIPE_PRO_MONTHLY_PLAN_ID`

**Webhook Setup:**

```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copy the webhook secret to STRIPE_WEBHOOK_SECRET
# Optional: verify signature handling end-to-end
npm run ops:stripe:webhook:verify -- --url=http://localhost:3000/api/webhooks/stripe
```

For production, add webhook endpoint in Stripe Dashboard:

- URL: `https://yourdomain.com/api/webhooks/stripe`
- Events: `checkout.session.completed`, `invoice.payment_succeeded`

### GitHub OAuth (Optional)

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create new OAuth App:
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
3. Add Client ID and Secret to `.env.local`

### Google OAuth (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → APIs & Services → Credentials
3. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
4. Add Client ID and Secret to `.env.local`

### Postmark (Email)

1. Sign up at [postmarkapp.com](https://postmarkapp.com)
2. Add a sender signature or domain
3. Get API token from Servers → API Tokens
4. Create email templates and get template IDs
5. Add to `.env.local`

### Anthropic Claude (AI Chatbot)

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Go to API Keys → Create Key
3. Copy your API key
4. Add to `.env.local`:
   - `ANTHROPIC_API_KEY` → Your Anthropic API key

**Note:** The AI chat feature uses Claude 3.5 Sonnet by default. You can customize the model in the conversation creation.

### Sentry (Monitoring)

1. Create a Sentry project
2. Add to `.env.local`:
   - `SENTRY_DSN`
   - `NEXT_PUBLIC_SENTRY_DSN`
   - Optional: `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`
3. For source map uploads (optional):
   - `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
4. Audit issue alert coverage:
   - `npm run ops:sentry:alerts:audit`

### Cron (Account Deletions)

1. Add a cron job that calls `/api/cron/process-deletions`
2. Set `CRON_SECRET` in your environment
3. Configure your cron runner to include:
   - `Authorization: Bearer <CRON_SECRET>`

## Available Scripts

```bash
bun run dev          # Start development server
bun run build        # Build for production
bun run start        # Start production server
bun run typecheck    # Run TypeScript type checking
bun run lint         # Run ESLint
bun run lint:fix     # Fix ESLint errors
bun run format:write # Format code with Prettier
bun run format:check # Check code formatting
bun run ci:release:gate # Format/lint/typecheck/tests/build release gate
bun run ops:stripe:webhook:verify # Verify Stripe webhook signature behavior
bun run ops:sentry:alerts:audit # Validate Sentry issue alert rule coverage
bun run ops:db:backup-restore:drill # Execute DB backup/restore drill (requires DB URLs)
bun run test:e2e:auth # Run authenticated E2E suites (requires E2E_TEST_EMAIL/E2E_TEST_PASSWORD)
bun run test:e2e:live-ai # Run live AI-response tests (requires E2E_RUN_LIVE_AI=true)
bun run test:e2e:redirects # Run protected-route redirect assertions (requires real Clerk setup)
```

### E2E Auth Configuration

To execute authenticated E2E coverage, set these env vars in `.env.local`:

```bash
E2E_TEST_EMAIL=<test-user-email>
E2E_TEST_PASSWORD=<test-user-password>
E2E_ASSERT_AUTH_REDIRECTS=true
```

For live AI-response E2E checks, also set:

```bash
E2E_RUN_LIVE_AI=true
```

For strict unauthenticated redirect assertions, run:

```bash
bun run test:e2e:redirects
```

This script sets `SKIP_CLERK_AUTH_HANDSHAKE=0`, so it should be used only with a real Clerk auth configuration.

## Development Workflow

### Before Committing

```bash
bun run typecheck    # Ensure no type errors
bun run lint:fix     # Fix linting issues
bun run format:write # Format code
```

### Database Changes

After modifying `prisma/schema.prisma`:

```bash
bunx prisma generate  # Regenerate Prisma Client
bunx prisma migrate dev   # Create/apply migrations
```

### Adding New Environment Variables

1. Add to `env.mjs` with Zod validation
2. Add to `.env.template` with description
3. Add actual value to `.env.local`

## Project Structure

```
InfiniStar/
├── app/
│   ├── (auth)/              # Authentication pages
│   ├── (dashboard)/         # Protected dashboard
│   │   └── dashboard/
│   │       └── conversations/  # Chat interface
│   ├── (marketing)/         # Public pages
│   ├── actions/             # Server actions
│   ├── api/                 # API routes
│   ├── components/          # Shared components
│   ├── context/             # React contexts
│   ├── hooks/               # Custom hooks (root)
│   ├── lib/                 # Utilities & configs
│   └── types/               # TypeScript types
├── config/                  # App configuration
├── prisma/                  # Database schema
└── public/                  # Static assets
```

## Troubleshooting

### Environment Variable Issues

**Error: "Environment validation failed"**

- Check that all required variables are set in `.env.local`
- See `.env.local.example` for the complete list
- Run `bun run dev` to see which variables are missing
- Ensure there are no typos in variable names

**Error: "Invalid DATABASE_URL"**

- Check the Postgres connection string format
- Ensure password is URL-encoded if it contains special characters
- Example: `postgresql://user:pass@host/dbname?sslmode=require`

**Missing NEXTAUTH_SECRET**

- Generate one with: `openssl rand -base64 32`
- Or use: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

### Build Errors

**Error: "Cannot find module"**

- Run `bun install`
- Run `bunx prisma generate`
- Delete `node_modules` and `.next`, then run `bun install` again

**Error: "Options object must provide a cluster"**

- Ensure `NEXT_PUBLIC_PUSHER_CLUSTER` is set in `.env.local`
- Restart your dev server after adding environment variables

**Error: "Module not found: Can't resolve '@/app/lib/...'"**

- Run `bunx prisma generate` to regenerate Prisma Client
- Check that all imports use the correct paths
- Restart your dev server

### Database Issues

**Error: "Can't reach database server"**

- Check `DATABASE_URL` is correct
- Verify Neon project/database is running
- Ensure network connectivity

**Error: "Authentication failed"**

- Verify database username/password in connection string
- Check user has read/write permissions

### Real-time Features Not Working

1. Check Pusher credentials are correct
2. Verify Pusher auth endpoint: `http://localhost:3000/api/pusher/auth`
3. Check browser console for Pusher connection errors
4. Ensure cluster matches your Pusher app cluster

### Stripe Webhooks Not Working

1. For local development, use Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
2. Check webhook secret matches
3. Verify webhook events are configured correctly

## Production Deployment

### Environment Variables

Set all environment variables in your hosting platform (Vercel, Railway, etc.)

**Important:** Change these for production:

- `NEXT_PUBLIC_APP_URL` → your production URL
- `NEXTAUTH_URL` → your production URL
- Use production API keys for Stripe, Pusher, etc.
- Generate new `NEXTAUTH_SECRET`

### Database

1. Create production Neon database
2. Update `DATABASE_URL` and `DIRECT_URL` to production connection strings
3. Run migrations: `bunx prisma migrate deploy`

### Stripe Webhooks

1. Add production webhook endpoint in Stripe Dashboard
2. Copy production webhook secret to env vars
3. Test with Stripe CLI in test mode first

## Support

- Check [TODO.md](TODO.md) for known issues and upcoming features
- Check [CLAUDE.md](CLAUDE.md) for codebase documentation
- Review [README.md](README.md) for project overview

## License

MIT License - see [LICENSE.md](LICENSE.md)
