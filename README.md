# InfiniStar

A real-time messaging and AI chatbot application built with Next.js, featuring subscription-based access, Stripe payments, and a modern dashboard for seamless conversations.

## ✨ Features

- **Real-time Messaging**: Instant message delivery using Pusher WebSockets
- **AI Chat Interface**: Modern, responsive chat interface for conversations
- **Subscription Management**: Stripe integration for premium subscriptions
- **Monetization Ready**: Optional affiliate placements and AdSense slots behind feature flags
- **Affiliate Analytics**: First-party affiliate click tracking with summary API reporting
- **Safety Pipeline**: Automatic moderation checks with report queue integration
- **Personalized Discovery**: Recommendation ranking for Explore, Feed, and character API
- **Creator Monetization**: Tips, memberships, and creator earnings dashboard
- **Multiple Auth Methods**: Email/password, GitHub OAuth, and Google OAuth
- **Modern UI**: Built with Tailwind CSS and Radix UI primitives
- **Dark Mode**: Support for light/dark themes using next-themes
- **Database**: Postgres (Neon) with Prisma ORM
- **Type Safety**: Full TypeScript support with strict type checking
- **Responsive Design**: Mobile-first approach for all screen sizes
- **Group Chats**: Support for multi-user conversations
- **Message Status**: See when messages are read by recipients

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Database**: Postgres (Neon)
- **ORM**: Prisma
- **Authentication**: Clerk
- **Payment Processing**: Stripe
- **Real-time**: Pusher
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI Primitives
- **Icons**: Lucide Icons
- **Form Handling**: React Hook Form
- **Validation**: Zod
- **State Management**: Zustand

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/yourusername/infinistar.git
cd infinistar
bun install

# Set up environment
cp .env.template .env.local
# Edit .env.local with your credentials

# Set up database
bunx prisma generate
bunx prisma migrate dev

# Run development server
bun run dev
```

Visit [http://localhost:3000](http://localhost:3000)

**📖 For detailed setup instructions, see [SETUP.md](SETUP.md)**

## 🔧 Environment Variables

All required environment variables are documented in [.env.template](.env.template).

**Essential services:**

- **Postgres (Neon)**: Database (`DATABASE_URL`, `DIRECT_URL` for migrations)
- **Clerk**: Authentication (`CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`)
- **Pusher**: Real-time messaging (4 variables)
- **Stripe**: Subscriptions (3 variables)
- **Postmark**: Email notifications (4 variables)
- **Sentry**: Monitoring/alerting (optional)
- **Monetization (optional)**: Affiliate links and AdSense slots (`NEXT_PUBLIC_ENABLE_AFFILIATE_LINKS`, `NEXT_PUBLIC_ENABLE_ADSENSE`, related IDs/URLs)
- **Affiliate analytics access (optional)**: Allowlist emails for `/api/affiliate/summary` via `AFFILIATE_ANALYTICS_ALLOWED_EMAILS`
- **Moderation reviewer access (optional)**: Allowlist emails for `/api/moderation/reports` via `MODERATION_REVIEWER_EMAILS`

See [SETUP.md](SETUP.md) for detailed configuration of each service.

## 📚 Documentation

- **[SETUP.md](SETUP.md)** - Complete setup and configuration guide
- **[CLAUDE.md](CLAUDE.md)** - Codebase architecture and patterns
- **[TODO.md](TODO.md)** - Known issues and planned features
- **[MIGRATION.md](MIGRATION.md)** - Recent fixes and changes
- **[PRODUCTION_PARITY_CHECKLIST.md](PRODUCTION_PARITY_CHECKLIST.md)** - Release gate and production checklist
- **[runbooks/](runbooks/)** - Operational runbooks (secrets, incidents, canary, Stripe, DB, Sentry)

## 🛠️ Development

```bash
bun run dev          # Start development server
bun run build        # Build for production
bun run typecheck    # Run TypeScript type checking
bun run lint:fix     # Fix linting issues
bun run format:write # Format code
bun run ci:release:gate # Local/CI quality gate
bun run ops:stripe:webhook:verify # Verify Stripe webhook signature handling
bun run test:e2e:auth # Run authenticated E2E suites (requires E2E_TEST_EMAIL/E2E_TEST_PASSWORD)
bun run test:e2e:live-ai # Run live AI-response E2E checks (requires E2E_RUN_LIVE_AI=true)
bun run test:e2e:redirects # Run auth redirect assertions (requires real Clerk auth env)
```

## 🧪 Recent Fixes (January 2025)

This codebase recently underwent major fixes to make it fully functional:

- ✅ Fixed duplicate directory structure issues
- ✅ Implemented real-time messaging with Pusher
- ✅ Fixed authentication session management
- ✅ Added input validation and security improvements
- ✅ Resolved all TypeScript errors
- ✅ Fixed Stripe webhook handlers
- ✅ Consolidated duplicate code

See [MIGRATION.md](MIGRATION.md) for complete details.

## 📝 License

Licensed under the [MIT license](LICENSE.md).

## Tags

```
#nextjs #typescript #ai #chatbot #stripe #tailwindcss #prisma #postgres #neon #react #subscription-saas #real-time #authentication #dashboard #web-application #messaging
```
