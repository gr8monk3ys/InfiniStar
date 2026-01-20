# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InfiniStar is an AI chatbot application built with Next.js 15 (App Router), featuring subscription-based access via Stripe, real-time messaging with Pusher, and a conversational interface. The application uses MongoDB for data persistence via Prisma ORM and NextAuth.js for authentication.

**Key Features:**

- AI-powered conversations with Claude (Anthropic)
- Real-time messaging with Pusher
- Message editing and deletion (soft delete)
- Conversation archiving (per-user archive status)
- Conversation pinning (per-user pin status, max 5 pins)
- **Auto-delete conversations** (per-user settings with configurable retention periods)
- Email verification and password reset
- User profile management with password changes
- Stripe subscription management
- Comprehensive security features (CSRF, rate limiting, input sanitization)
- Multiple AI personalities and model selection
- Comprehensive accessibility (ARIA labels, keyboard navigation)

## Development Commands

```bash
# Development
npm run dev              # Start development server on localhost:3000
npm run build            # Build for production
npm run start            # Start production server
npm run preview          # Build and start production server

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint errors automatically
npm run typecheck        # Run TypeScript type checking (no emit)
npm run format:write     # Format code with Prettier
npm run format:check     # Check code formatting

# Testing
npm test                 # Run all Jest tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report
npm run test:e2e         # Run Playwright E2E tests
npm run test:e2e:ui      # Run E2E tests with Playwright UI
npm run test:e2e:headed  # Run E2E tests in headed browser

# Run a single test file
npx jest app/__tests__/lib/sanitize.test.ts

# Run tests matching a pattern
npx jest --testNamePattern="sanitizeMessage"

# Database
npx prisma generate      # Generate Prisma Client
npx prisma db push       # Push schema changes to database (development)
npx prisma studio        # Open Prisma Studio to view/edit data
npm run seed             # Seed database with test data
```

## Architecture

### Next.js App Router Structure

The project uses Next.js 13+ App Router with route groups:

- `app/(auth)/` - Authentication pages (login, register)
- `app/(dashboard)/dashboard/` - Protected dashboard routes
  - `conversations/` - Conversation list and individual conversation views
  - `conversations/[conversationId]/` - Dynamic conversation detail pages
- `app/(marketing)/` - Public marketing pages (landing, pricing, explore)
- `app/(docs)/` - Documentation pages

### Key Architectural Patterns

**Server Actions Pattern**: Server-side data fetching functions are centralized in `app/actions/`:

- `getCurrentUser()` - Get authenticated user from session
- `getConversations()` - Fetch user's conversations with latest messages
- `getConversationById()` - Fetch specific conversation with messages and participants
- `getMessages()` - Fetch messages for a conversation
- `getSession()` - Get NextAuth session

**API Routes**: REST endpoints in `app/api/`:

- `auth/[...nextauth]/` - NextAuth.js authentication handler
- `register/` - User registration with email verification
- `auth/verify-email/` - Email verification endpoint
- `auth/resend-verification/` - Resend verification link (rate-limited)
- `auth/request-reset/` - Request password reset link (rate-limited, no user enumeration)
- `auth/reset-password/` - Reset password with token
- `auth/2fa/setup/` - Initialize 2FA setup, generate TOTP secret and QR code
- `auth/2fa/verify/` - Verify TOTP code and enable 2FA, returns backup codes
- `auth/2fa/disable/` - Disable 2FA (requires password and verification code)
- `auth/2fa/backup-codes/` - Generate new backup codes (GET: count, POST: regenerate)
- `auth/2fa/login-verify/` - Verify 2FA code during login flow
- `csrf/` - CSRF token generation
- `conversations/` - Create/list conversations
- `conversations/[conversationId]/` - Delete conversation
- `conversations/[conversationId]/seen/` - Mark messages as seen
- `conversations/[conversationId]/archive/` - Archive (POST) or unarchive (DELETE) conversation
- `conversations/[conversationId]/pin/` - Pin (POST) or unpin (DELETE) conversation (max 5 pins)
- `conversations/[conversationId]/summarize/` - Generate (POST) or get (GET) AI summary of conversation
- `messages/` - Send new messages
- `messages/[messageId]/` - Edit (PATCH) or delete (DELETE) messages
- `profile/` - Get (GET) or update (PATCH) user profile and password
- `notifications/preferences/` - Get (GET) or update (PATCH) notification preferences
- `sessions/` - List (GET), register (POST), or revoke all (DELETE) user sessions
- `sessions/[sessionId]/` - Revoke (DELETE) or update (PATCH) specific session
- `ai/chat/` - AI chat endpoint for single responses
- `ai/chat-stream/` - Streaming AI responses with SSE
- `ai/usage/` - Get AI usage statistics for current user
- `pusher/auth/` - Pusher channel authentication
- `webhooks/stripe/` - Stripe webhook handler for subscription events

**Real-time Updates**: Pusher integration for live message updates:

- Server-side: `pusherServer` in `app/libs/pusher.ts`
- Client-side: `pusherClient` subscribes to conversation channels
- Custom hooks in `app/(dashboard)/dashboard/hooks/`:
  - `useActiveChannel()` - Subscribe to conversation updates
  - `useOtherUser()` - Get conversation participant info

**Authentication Flow**:

- NextAuth.js configuration in `app/lib/auth.ts`
- Supports GitHub OAuth, Google OAuth, and email/password via Credentials provider
- Prisma adapter for session/user storage
- JWT session strategy
- **Email Verification**: Required for credentials-based login
  - Cryptographically secure 32-byte tokens with 24-hour expiry
  - Rate-limited resend functionality (5 requests per 5 minutes)
  - Development mode logs verification links to console
  - Pages: `/verify-email`, `/resend-verification`
- **Password Reset**: Secure token-based password reset flow
  - Tokens expire after 24 hours
  - No user enumeration (consistent responses)
  - Bcrypt password hashing with 12 rounds
  - Show/hide password toggle
  - Pages: `/forgot-password`, `/reset-password`
- **Two-Factor Authentication (2FA)**: TOTP-based 2FA for enhanced security
  - Uses `otplib` for TOTP generation/verification with 30-second window and 1-step tolerance
  - TOTP secrets encrypted at rest using AES-256-GCM derived from NEXTAUTH_SECRET
  - 10 single-use backup codes (hashed with SHA-256 for storage)
  - QR code generation for authenticator app setup
  - Rate-limited verification attempts (5 per 5 minutes)
  - Pages: `/login/2fa` (login verification), Profile Settings > Security tab
- **Security Features**:
  - CSRF protection on all state-changing endpoints
  - Rate limiting on authentication endpoints
  - Input validation with Zod schemas
  - DOMPurify sanitization for user inputs

**Subscription System**:

- User model includes Stripe fields: `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `stripeCurrentPeriodEnd`
- Subscription plans defined in `config/subscriptions.ts` (free and PRO tiers)
- Stripe webhooks handle `checkout.session.completed` and `invoice.payment_succeeded` events
- Stripe client initialized in `app/lib/stripe.ts`

**AI Integration**:

- Claude API integration via Anthropic SDK
- Multiple AI personalities available:
  - `helpful` - Friendly and balanced assistant (default)
  - `concise` - Brief, to-the-point responses
  - `creative` - Imaginative and original thinking
  - `analytical` - Logical, structured analysis
  - `empathetic` - Understanding and compassionate
  - `professional` - Formal business communication
  - `custom` - User-defined system prompts
- Model selection support:
  - Claude 3.5 Sonnet (default, recommended)
  - Claude 3.5 Haiku (faster, cheaper)
  - Claude 3 Opus (most capable)
- AI usage tracking per user with monthly limits
- Streaming responses via Server-Sent Events (SSE)
- Conversation context management (last 10 messages)
- AI conversations stored in database with `isAI: true` flag

**API Client Pattern**:

- Centralized request handling in `app/lib/api-client.ts`
- Automatic retry with exponential backoff (1s → 2s → 4s)
- Smart error classification (retryable vs non-retryable)
- User-friendly error messages for common scenarios
- Loading toast helpers for UX feedback
- Configurable timeout (default 30s) and retry settings
- Handles network errors, timeouts, and server errors gracefully

### Database Schema

Prisma models (MongoDB):

- `User` - User accounts with authentication and Stripe subscription data
  - Includes email verification fields: `emailVerified`, `verificationToken`, `verificationTokenExpiry`
  - Includes password reset fields: `resetToken`, `resetTokenExpiry`
  - Includes AI usage tracking: `aiUsageCount`, `aiUsageResetDate`
  - Includes notification preferences: `emailNotifications`, `emailDigest`, `notifyOnNewMessage`, `notifyOnMention`, `notifyOnAIComplete`, `mutedConversations`
- `Account` - OAuth provider accounts (NextAuth)
- `Session` - User sessions (NextAuth)
- `Conversation` - Chat conversations (supports 1-on-1, group chats, and AI chats)
  - AI conversation fields: `isAI`, `aiModel`, `aiPersonality`, `aiSystemPrompt`
  - Summary fields: `summary`, `summaryGeneratedAt`, `summaryMessageCount`
- `Message` - Individual messages with sender, body, image, and seen status

Key relationships:

- Users have many-to-many relationships with Conversations
- Messages belong to Conversations and Users
- Messages track which Users have seen them (many-to-many)

### Environment Variables

Environment validation is enforced via `env.mjs` using `@t3-oss/env-nextjs` and Zod schemas. Required variables are documented in `.env.local.example`:

**Authentication**:

- `NEXTAUTH_SECRET` - NextAuth.js secret (generate with `openssl rand -base64 32`)
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_ACCESS_TOKEN` - GitHub OAuth
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth

**Database**:

- `DATABASE_URL` - MongoDB connection string (MongoDB Atlas recommended)

**Email**:

- `POSTMARK_API_TOKEN` - Postmark server token for sending emails
- `POSTMARK_SIGN_IN_TEMPLATE`, `POSTMARK_ACTIVATION_TEMPLATE` - Email template IDs
- `SMTP_FROM` - Sender email address

**Subscriptions**:

- `STRIPE_API_KEY` - Stripe secret key (test or production)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `STRIPE_PRO_MONTHLY_PLAN_ID` - Stripe price ID for PRO plan

**Real-time Messaging**:

- `PUSHER_APP_ID` - Pusher application ID
- `PUSHER_SECRET` - Pusher secret key
- `NEXT_PUBLIC_PUSHER_APP_KEY` - Pusher public key (client-side)
- `NEXT_PUBLIC_PUSHER_CLUSTER` - Pusher cluster (e.g., us2, eu)

**AI Integration**:

- `ANTHROPIC_API_KEY` - Anthropic API key for Claude integration

**App**:

- `NEXT_PUBLIC_APP_URL` - Application base URL (http://localhost:3000 for dev)

### UI Components

Component structure:

- `app/components/ui/` - Radix UI-based primitives (buttons, dialogs, forms, etc.)
- `app/components/` - Shared application components (modals, icons, headers)
- `app/(dashboard)/dashboard/conversations/components/` - Conversation-specific components (ConversationBox, MessageBox, Header, ProfileDrawer)

Styling: Tailwind CSS with `tailwind-merge` for class merging and `class-variance-authority` for component variants.

### Type Definitions

Custom types in `app/types/`:

- `FullMessageType` - Message with sender and seen users populated
- `FullConversationType` - Conversation with users and messages populated
- `DashboardConfig` - Dashboard navigation configuration
- `SubscriptionPlan` - Stripe subscription plan structure

## Common Workflows

### Adding a New API Route

1. Create route handler in `app/api/[route]/route.ts`
2. Use `getCurrentUser()` from `app/actions/getCurrentUser.ts` for authentication
3. Use `prisma` from `app/libs/prismadb.ts` for database operations
4. For real-time updates, trigger Pusher events via `pusherServer`
5. For state-changing operations, validate CSRF tokens from headers
6. Apply rate limiting for sensitive endpoints using `app/lib/rate-limit.ts`

### Using the API Client

The centralized API client provides consistent error handling and retry logic:

```typescript
import { api, createLoadingToast } from "@/app/lib/api-client"

// Basic usage with automatic error handling
const data = await api.post("/api/endpoint", { payload })

// With loading toast and custom configuration
const loader = createLoadingToast("Processing...")
try {
  const response = await api.post("/api/endpoint", payload, {
    retries: 2, // Number of retries (default: 2)
    retryDelay: 1000, // Initial delay in ms (default: 1000)
    timeoutMs: 30000, // Request timeout (default: 30000)
    showErrorToast: false, // Manually handle errors
  })
  loader.success(response.message)
} catch (error) {
  loader.error(error.message)
}
```

**API Client Features:**

- Automatic retry with exponential backoff for network errors and 5xx responses
- Smart error classification (retryable vs non-retryable)
- User-friendly error messages for common scenarios
- Loading toast helpers for UX feedback
- 30-second timeout protection

### Working with Conversations

- Conversations are fetched via `getConversations()` action which includes last message and participants
- Individual conversations use `getConversationById()` which includes all messages
- Real-time updates are handled via `useActiveChannel()` hook that subscribes to Pusher channels
- Message seen status is tracked via the `Message.seen` many-to-many relationship
- AI conversations are created via `createAIConversation()` server action with personality and model selection
- **Archiving Conversations**: Users can archive conversations to hide them from the main list
  - POST `/api/conversations/[conversationId]/archive` - Archive conversation for current user
  - DELETE `/api/conversations/[conversationId]/archive` - Unarchive conversation for current user
  - Per-user archive status: Each user has their own archive state for shared conversations
  - `archivedBy` array stores user IDs who archived the conversation
  - `archivedAt` timestamp tracks when first user archived the conversation
  - Real-time updates via Pusher `conversation:archive` and `conversation:unarchive` events on user-specific channel
  - UI features: Toggle button in ConversationList with archived count badge, archive/unarchive button in ProfileDrawer
  - Archived conversations are filtered from main view with option to show/hide via toggle
- **Conversation Summarization**: AI-powered summary generation for conversations
  - POST `/api/conversations/[conversationId]/summarize` - Generate new summary (with optional `forceRegenerate`)
  - GET `/api/conversations/[conversationId]/summarize` - Get existing summary
  - Summary includes: overview, key topics, decisions/action items, participants
  - Requires minimum 5 messages in conversation
  - Uses Claude 3.5 Sonnet for intelligent summarization
  - Summary caching: stores `summary`, `summaryGeneratedAt`, `summaryMessageCount` in Conversation model
  - Cache invalidation: regenerates only when message count changes or `forceRegenerate: true`
  - Context limit: last 50 messages to stay within token limits
  - Rate limited using `aiChatLimiter` (20 requests per minute)
  - UI: "Summarize" button in conversation header with SummaryModal component
- **Pinning Conversations**: Users can pin important conversations to the top of the list
  - POST `/api/conversations/[conversationId]/pin` - Pin conversation for current user
  - DELETE `/api/conversations/[conversationId]/pin` - Unpin conversation for current user
  - Per-user pin status: Each user has their own pin state for shared conversations
  - `pinnedBy` array stores user IDs who pinned the conversation
  - `pinnedAt` timestamp tracks when first user pinned the conversation
  - Maximum of 5 pinned conversations per user
  - Real-time updates via Pusher `conversation:pin` and `conversation:unpin` events on user-specific channel
  - UI features: Pin icon displayed on pinned conversations, separate "Pinned" section in ConversationList, pin/unpin button in ProfileDrawer
  - Pinned conversations appear at the top of the conversation list in their own section
- **Auto-Delete Conversations**: Users can automatically delete old conversations based on retention settings
  - GET `/api/settings/auto-delete` - Get current auto-delete settings
  - PATCH `/api/settings/auto-delete` - Update auto-delete settings
  - POST `/api/settings/auto-delete/preview` - Preview conversations that would be deleted
  - POST `/api/settings/auto-delete/run` - Manually trigger cleanup (rate-limited to once per hour)
  - Per-user settings stored in User model:
    - `autoDeleteEnabled` - Boolean toggle for the feature
    - `autoDeleteAfterDays` - Retention period options: 7, 14, 30, 60, 90, 180, 365 days
    - `autoDeleteArchived` - Whether to include archived conversations
    - `autoDeleteExcludeTags` - Array of tag IDs to exclude from deletion
    - `lastAutoDeleteRun` - Timestamp of last cleanup
  - Deletion logic in `app/lib/auto-delete.ts`:
    - `getAutoDeleteSettings(userId)` - Get user's auto-delete settings
    - `updateAutoDeleteSettings(userId, settings)` - Update settings
    - `getConversationsToDelete(userId)` - Get eligible conversations
    - `getAutoDeletePreview(userId)` - Preview what would be deleted
    - `deleteOldConversations(userId)` - Perform the deletion
    - `runAutoDeleteForAllUsers()` - For cron job integration
  - UI: "Auto-Delete" tab in Profile Settings page with toggle, retention period select, tag exclusion, preview modal
  - Real-time updates via Pusher `conversation:auto-delete` event to all conversation participants
  - **Cron Job**: For production, set up a scheduled function to call `runAutoDeleteForAllUsers()` daily

### Working with Messages

- **Editing Messages**: Users can edit their own messages (not AI messages, not images)
  - PATCH `/api/messages/[messageId]` with `{ body: string }`
  - Only message sender can edit
  - Editing updates `editedAt` timestamp
  - Real-time updates via Pusher `message:update` event
  - UI shows "(edited)" indicator with tooltip
- **Deleting Messages**: Users can delete their own messages (soft delete)
  - DELETE `/api/messages/[messageId]`
  - Only message sender can delete
  - Soft delete sets `isDeleted: true`, `deletedAt` timestamp, clears `body` and `image`
  - Real-time updates via Pusher `message:delete` event
  - UI shows "This message was deleted" placeholder
- **Message Constraints**:
  - Cannot edit/delete AI messages
  - Cannot edit already deleted messages
  - Maximum message length: 5000 characters

### Working with User Profiles

- **Profile Management**: Users can edit their profile at `/dashboard/profile`
  - GET `/api/profile` - Fetch current user profile
  - PATCH `/api/profile` - Update profile fields
  - Profile fields: `name`, `bio` (500 chars max), `location` (100 chars max), `website` (URL validated)
  - Tabbed interface: Profile Information and Change Password
- **Password Changes**:
  - Requires current password verification
  - Minimum 8 characters for new password
  - Cannot change password for OAuth-only accounts
  - Updates `hashedPassword` with bcrypt (12 rounds)
- **Session Updates**: Profile changes update NextAuth session in real-time
- **Validation**: Zod schemas validate all inputs (URL format, character limits, etc.)

### Working with Sessions

- **Session Management**: Users can view and manage active sessions at `/dashboard/profile` (Sessions tab)
  - GET `/api/sessions` - List all active sessions for current user
  - POST `/api/sessions` - Register a new session (called after login)
  - DELETE `/api/sessions` - Revoke all other sessions except current
  - DELETE `/api/sessions/[sessionId]` - Revoke a specific session
- **Session Tracking**:
  - Sessions stored in `UserSession` model with device/browser info
  - IP addresses parsed from `x-forwarded-for` or `x-real-ip` headers
  - User agent parsed with `ua-parser-js` for device type, browser, and OS
  - Sessions expire after 30 days
- **Security Features**:
  - IP addresses partially masked when displayed (e.g., `192.168.x.x`)
  - CSRF protection on all session management endpoints
  - Sessions can be revoked individually or all at once
  - Current session identified via `X-Session-Token` header
  - Session tokens stored in localStorage (`infinistar_session_token`)
- **UI Components**:
  - `SessionsList` component displays all active sessions
  - Shows device icon, browser, OS, masked IP, and last active time
  - Current session badge identifies the active session
  - Confirmation dialog before revoking sessions

### Working with AI Features

- Check AI usage limits with `checkAIUsage()` from `app/lib/subscription.ts`
- Free tier: 10 messages per month, PRO: unlimited
- AI personalities configured in `app/lib/ai-personalities.ts`
- Stream AI responses using SSE endpoint `/api/ai/chat-stream`
- Track usage via `app/api/ai/usage/` endpoint

### Authentication & Security

- **Email Verification**: New users must verify email before login
  - Token generation: `generateVerificationToken()` from `app/lib/email-verification.ts`
  - Email sending: `sendVerificationEmail()` from `app/lib/email.ts`
  - Development mode logs links to console instead of sending emails
- **Password Reset**: Secure token-based flow with no user enumeration
  - Request reset: `/api/auth/request-reset` (rate-limited)
  - Reset password: `/api/auth/reset-password` (validates token)
- **Rate Limiting**: Apply to sensitive endpoints

  ```typescript
  import { authLimiter, getClientIdentifier } from '@/app/lib/rate-limit';

  const identifier = getClientIdentifier(request);
  if (!authLimiter.check(identifier)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  ```

### Subscription Integration

- Check user subscription status via `User.stripeCurrentPeriodEnd` field
- Stripe webhooks automatically update user subscription data
- Subscription plans (free/PRO) are defined in `config/subscriptions.ts`
- Use `getUserSubscriptionPlan()` from `app/lib/subscription.ts` to get current plan

## Important Notes

- **Prisma Client**: Use the singleton instance from `app/libs/prismadb.ts` (not `app/lib/prismadb.ts` - both exist, prefer `app/libs/`)
- **Route Groups**: Parentheses in directory names like `(dashboard)` are Next.js route groups - they don't appear in URLs
- **MongoDB ObjectIDs**: All IDs are MongoDB ObjectIDs, use `@db.ObjectId` in Prisma schema
- **Real-time**: Pusher channel naming follows pattern: `conversation-${conversationId}`
- **Type Safety**: The project uses TypeScript strictly - always run `npm run typecheck` before committing
- **API Client**: Always use the centralized API client (`app/lib/api-client.ts`) for frontend API requests instead of raw axios
- **Email Verification**: Required for credentials login; OAuth users skip verification
- **Password Reset Tokens**: Expire after 24 hours; use `isTokenExpired()` utility for validation
- **Development Emails**: In development mode, email links are logged to console instead of being sent
- **Rate Limiting**: Authentication endpoints limited to 5 requests per 5 minutes per identifier. 2FA verification limited to 5 attempts per 5 minutes. Uses in-memory rate limiter (see `IRateLimiter` interface in `app/lib/rate-limit.ts` for Redis implementation guide for production)
- **Two-Factor Authentication**: Only available for accounts with passwords (not OAuth-only). TOTP secrets are encrypted with AES-256-GCM using keys derived from NEXTAUTH_SECRET. Backup codes are single-use and hashed with SHA-256.
- **CSRF Protection**: All POST/PUT/DELETE endpoints should validate CSRF tokens
- **AI Usage Tracking**: Free users limited to 10 AI messages per month; tracked via `User.aiUsageCount`
- **Server Actions**: Next.js 15 server actions require `'use server'` directive at the top of the file
- **Environment Setup**: See `.env.local.example` for complete setup guide; use `SETUP.md` for service configuration

## Security Best Practices

1. **No User Enumeration**: Authentication endpoints return consistent messages regardless of whether user exists
2. **Token Expiry**: All tokens (verification, password reset) expire after 24 hours
3. **Rate Limiting**: Apply to all authentication and sensitive endpoints
4. **Input Validation**: Use Zod schemas for all request body validation
5. **Password Hashing**: Bcrypt with 12 rounds for all password storage
6. **CSRF Protection**: Validate tokens on all state-changing operations
7. **Sanitization**: Use `sanitizeMessage()` from `app/lib/sanitize.ts` for user messages before storage. The sanitize library is server-safe (regex-based, no DOMPurify dependency issues)
8. **Error Messages**: Provide helpful but secure error messages that don't leak sensitive information
9. **2FA Secret Encryption**: TOTP secrets are encrypted at rest using AES-256-GCM with PBKDF2-derived keys (100,000 iterations)
10. **Backup Codes**: Generated with crypto.randomBytes, hashed with SHA-256 for storage, single-use (removed after verification)
