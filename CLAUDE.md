# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InfiniStar is an AI chatbot application built with Next.js 15 (App Router), featuring subscription-based access via Stripe, real-time messaging with Pusher, and a conversational interface. The application uses Postgres (Neon) for data persistence via Prisma ORM and Clerk for authentication.

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
bun run test                 # Run all Jest tests
bun run test:watch           # Run tests in watch mode
bun run test:coverage        # Run tests with coverage report
bun run test:e2e             # Run Playwright E2E tests
bun run test:e2e:ui          # Run E2E tests with Playwright UI
bun run test:e2e:headed      # Run E2E tests in headed browser

# Run a single test file
npx jest app/__tests__/lib/sanitize.test.ts

# Run tests matching a pattern
npx jest --testNamePattern="sanitizeMessage"

# Database
npx prisma generate      # Generate Prisma Client
npx prisma db push       # Push schema changes to database (development)
npx prisma studio        # Open Prisma Studio to view/edit data
bun run seed             # Seed database with test data
```

## Architecture

### Next.js App Router Structure

The project uses Next.js 15 App Router with route groups:

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

### Key Architectural Patterns

**Server Actions Pattern**: Server-side data fetching functions are centralized in `app/actions/`:

- `getCurrentUser()` - Get authenticated user from Clerk session via `clerkId`
- `getConversations()` - Fetch user's conversations with latest messages
- `getConversationById()` - Fetch specific conversation with messages and participants
- `getMessages()` - Fetch messages for a conversation
- `getSession()` - Get Clerk session with user info
- `getUsers()` - Fetch users list
- `createAIConversation()` - Create new AI conversation with personality and model selection
- `getCharacterForUser()` - Fetch a specific character for the current user
- `getCharactersForUser()` - Fetch all characters for the current user

**API Routes**: REST endpoints in `app/api/`:

- `webhooks/clerk/` - Clerk webhook handler for user.created, user.updated, user.deleted events
- `webhooks/stripe/` - Stripe webhook handler for subscription events
- `csrf/` - CSRF token generation
- `health/` - Health check endpoint
- `conversations/` - Create/list conversations
- `conversations/[conversationId]/` - Delete conversation
- `conversations/[conversationId]/seen/` - Mark messages as seen
- `conversations/[conversationId]/archive/` - Archive (POST) or unarchive (DELETE) conversation
- `conversations/[conversationId]/pin/` - Pin (POST) or unpin (DELETE) conversation (max 5 pins)
- `conversations/[conversationId]/mute/` - Mute (POST) or unmute (DELETE) conversation
- `conversations/[conversationId]/summarize/` - Generate (POST) or get (GET) AI summary
- `conversations/[conversationId]/export/` - Export conversation in various formats
- `conversations/[conversationId]/typing/` - Typing indicator events
- `conversations/[conversationId]/tags/` - Manage tags on a conversation
- `conversations/[conversationId]/tags/[tagId]/` - Remove tag from conversation
- `conversations/[conversationId]/share/` - Create/list conversation shares
- `conversations/[conversationId]/share/[shareId]/` - Manage specific share
- `conversations/[conversationId]/share/[shareId]/join/` - Join shared conversation
- `messages/` - Send new messages
- `messages/[messageId]/` - Edit (PATCH) or delete (DELETE) messages
- `messages/[messageId]/react/` - Add/remove message reactions
- `messages/search/` - Search messages
- `profile/` - Get (GET) or update (PATCH) user profile
- `notifications/preferences/` - Get (GET) or update (PATCH) notification preferences
- `ai/chat/` - AI chat endpoint for single responses
- `ai/chat-stream/` - Streaming AI responses with SSE
- `ai/usage/` - Get AI usage statistics for current user
- `ai/regenerate/` - Regenerate an AI response
- `ai/suggestions/` - Get AI-generated conversation suggestions
- `ai/memory/` - List (GET) or create (POST) AI memories
- `ai/memory/[key]/` - Get, update, or delete specific AI memory
- `ai/memory/extract/` - AI-powered memory extraction from conversation
- `characters/` - List (GET) or create (POST) characters
- `characters/[characterId]/` - Get, update, or delete specific character
- `characters/[characterId]/like/` - Like/unlike a character
- `characters/favorites/` - Get user's favorite characters
- `tags/` - List (GET) or create (POST) tags
- `tags/[tagId]/` - Update or delete specific tag
- `templates/` - List (GET) or create (POST) message templates
- `templates/[templateId]/` - Update or delete specific template
- `templates/[templateId]/use/` - Use a template (increments usage count)
- `templates/popular/` - Get popular templates
- `templates/shortcut/` - Lookup template by shortcut
- `settings/auto-delete/` - Get (GET) or update (PATCH) auto-delete settings
- `settings/auto-delete/preview/` - Preview conversations that would be deleted
- `settings/auto-delete/run/` - Manually trigger auto-delete cleanup
- `search/` - Global search endpoint
- `share/[token]/` - Get public share info by token
- `share/[token]/join/` - Join a shared conversation by token
- `stripe/checkout/` - Create Stripe checkout session
- `stripe/portal/` - Create Stripe customer portal session
- `account/` - Account deletion request (GDPR)
- `account/deletion-status/` - Check deletion status
- `account/cancel-deletion/` - Cancel pending account deletion
- `users/presence/` - Update user presence status
- `moderation/blocks/` - User blocking
- `moderation/reports/` - Content reporting
- `pusher/auth/` - Pusher channel authentication
- `cron/auto-delete/` - Cron endpoint for auto-delete processing
- `cron/process-deletions/` - Cron endpoint for processing account deletions

**Real-time Updates**: Pusher integration for live message updates:

- Server-side: `pusherServer` in `app/lib/pusher.ts`
- Client-side: `pusherClient` subscribes to conversation channels
- Custom hooks in `app/(dashboard)/dashboard/hooks/`:
  - `useActiveChannel()` - Subscribe to conversation updates
  - `useActiveList()` - Track active users
  - `useConversation()` - Get current conversation ID from route
  - `useDebounce()` - Debounce hook for search inputs
  - `useGlobalSearch()` - Global search across conversations and messages
  - `useOtherUser()` - Get conversation participant info
  - `usePresence()` - User presence tracking
  - `useRoutes()` - Navigation route configuration
  - `useSidebar()` - Sidebar state management

**Authentication Flow**:

- **Clerk** (`@clerk/nextjs`) handles all authentication
- Root layout wraps the app in `<ClerkProvider>`
- Auth pages use Clerk's pre-built `<SignIn />` and `<SignUp />` components
- Server-side auth uses `auth()` from `@clerk/nextjs/server` to get `userId` (Clerk ID)
- User lookup maps Clerk's `userId` to the local database via the `User.clerkId` field
- `getCurrentUser()` in `app/actions/getCurrentUser.ts` is the primary auth helper
- `getSession()` in `app/actions/getSession.ts` uses `auth()` and `currentUser()` from Clerk
- Clerk handles email verification, password reset, OAuth providers, and MFA natively
- **Clerk Webhook** at `/api/webhooks/clerk/` syncs user data to the local database:
  - `user.created` - Creates a new User record with `clerkId`, email, name, and image
  - `user.updated` - Updates email, name, and image from Clerk
  - `user.deleted` - Deletes the User record from the database
  - Webhook signatures verified using `svix` library
- **Two-Factor Authentication**: Clerk handles 2FA natively. Additionally, `app/lib/two-factor-tokens.ts` provides an in-memory token store for supplementary 2FA flows. **Limitation**: This in-memory store does not persist across server restarts and does not work with multiple server instances. For production, replace with Redis or another distributed cache.
- **Security Features**:
  - CSRF protection on all state-changing endpoints (Double Submit Cookie pattern via `app/lib/csrf.ts`)
  - Rate limiting on sensitive endpoints (in-memory, see production note below)
  - Input validation with Zod schemas
  - Regex-based sanitization for user inputs (server-safe, no DOMPurify dependency)

**Subscription System**:

- User model includes Stripe fields: `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `stripeCurrentPeriodEnd`
- Subscription plans defined in `config/subscriptions.ts` (free and PRO tiers)
- Stripe webhooks handle `checkout.session.completed` and `invoice.payment_succeeded` events
- Stripe client initialized in `app/lib/stripe.ts`
- Checkout and portal session creation via `/api/stripe/checkout` and `/api/stripe/portal`

**AI Integration**:

- Claude API integration via Anthropic SDK (`@anthropic-ai/sdk`)
- Multiple AI personalities available (configured in `app/lib/ai-personalities.ts`):
  - `assistant` - Helpful, accurate, and friendly AI assistant (default)
  - `creative` - Imaginative AI for creative writing and brainstorming
  - `technical` - Precise technical expert for code and engineering
  - `friendly` - Warm, conversational companion
  - `professional` - Formal business consultant
  - `socratic` - Teaching-focused tutor that guides through questions
  - `concise` - Brief, to-the-point advisor
  - `custom` - User-defined system prompts
- Model selection support (configured in `app/lib/ai-models.ts`):
  - Claude 3.5 Sonnet (default, recommended)
  - Claude 3 Haiku (faster, cheaper)
  - Claude 3 Opus (most capable)
- AI usage tracking per user stored in `AiUsage` model with token counts and cost estimation
- Token usage tracked per message (`inputTokens`, `outputTokens` fields on Message)
- Streaming responses via Server-Sent Events (SSE) at `/api/ai/chat-stream`
- AI conversations stored in database with `isAI: true` flag
- **AI Memory**: Persistent memory across conversations (`app/lib/ai-memory.ts`)
  - Memory categories: PREFERENCE, FACT, CONTEXT, INSTRUCTION, RELATIONSHIP
  - Limits: 50 memories (free), 200 memories (PRO)
  - AI-powered memory extraction from conversation context
- **Custom Characters**: Users can create AI characters with custom system prompts
  - Characters have name, tagline, description, greeting, system prompt, avatar
  - Public marketplace with featured characters
  - Like/favorite system for characters
  - Characters linked to conversations via `characterId`

**API Client Pattern**:

- Centralized request handling in `app/lib/api-client.ts`
- Automatic retry with exponential backoff (1s -> 2s -> 4s)
- Smart error classification (retryable vs non-retryable)
- User-friendly error messages for common scenarios
- Loading toast helpers for UX feedback
- Configurable timeout (default 30s) and retry settings
- Handles network errors, timeouts, and server errors gracefully

### Database Schema

Prisma models (Postgres via Neon with `@prisma/adapter-neon`):

- `User` (`users`) - User accounts with Clerk auth, Stripe subscription data, and preferences
  - Auth: `clerkId` (unique, maps to Clerk user ID), `emailVerified`
  - Profile: `name`, `email`, `image`, `bio`, `location`, `website`
  - Presence: `presenceStatus`, `lastSeenAt`, `customStatus`, `customStatusEmoji`
  - GDPR deletion: `deletionRequested`, `deletionRequestedAt`, `deletionScheduledFor`, `deletionCancelledAt`
  - Notification preferences: `emailNotifications`, `emailDigest`, `notifyOnNewMessage`, `notifyOnMention`, `notifyOnAIComplete`, `mutedConversations`
  - Auto-delete settings: `autoDeleteEnabled`, `autoDeleteAfterDays`, `autoDeleteArchived`, `autoDeleteExcludeTags`, `lastAutoDeleteRun`
  - Stripe: `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `stripeCurrentPeriodEnd`
- `Conversation` (`conversations`) - Chat conversations (supports 1-on-1, group chats, and AI chats)
  - AI fields: `isAI`, `aiModel`, `aiPersonality`, `aiSystemPrompt`, `characterId`
  - Organization: `archivedBy`, `archivedAt`, `pinnedBy`, `pinnedAt`, `mutedBy`, `mutedAt`
  - Summary: `summary`, `summaryGeneratedAt`, `summaryMessageCount`
- `Character` (`characters`) - Custom AI characters with system prompts
  - Fields: `name`, `slug`, `tagline`, `description`, `greeting`, `systemPrompt`, `avatarUrl`, `coverImageUrl`, `tags`, `category`
  - Visibility: `isPublic`, `featured`, `viewCount`, `usageCount`, `likeCount`
- `Message` (`messages`) - Individual messages with sender, body, image, and seen status
  - Edit/delete: `editedAt`, `deletedAt`, `isDeleted`
  - AI: `isAI`, `inputTokens`, `outputTokens`
  - Reactions: `reactions` (JSON)
  - Threading: `replyToId` self-referencing relation
- `AiUsage` (`ai_usage`) - Per-request AI usage tracking with token counts and cost estimation
- `Tag` (`tags`) - User-specific tags for organizing conversations (unique per user)
- `AIMemory` (`ai_memories`) - Persistent AI memory entries with categories and importance levels
- `MessageTemplate` (`message_templates`) - Reusable message templates with optional shortcuts
- `ConversationShare` (`conversation_shares`) - Conversation sharing with token-based access
  - Share types: `LINK` (public) or `INVITE` (restricted to specific emails)
  - Permissions: `VIEW` (read-only) or `PARTICIPATE` (can send messages)
- `UserBlock` (`user_blocks`) - User blocking relationships
- `ContentReport` (`content_reports`) - Content moderation reports
- `CharacterLike` (`character_likes`) - Character like/favorite tracking

Key relationships:

- Users have many-to-many relationships with Conversations
- Messages belong to Conversations and Users
- Messages track which Users have seen them (many-to-many)
- Messages can reply to other Messages (self-referencing)
- Characters are created by Users and linked to Conversations
- Tags are user-specific and have many-to-many with Conversations

### Environment Variables

Environment validation is enforced via `env.mjs` using `@t3-oss/env-nextjs` and Zod schemas. Required variables are documented in `.env.local.example`:

**Authentication (Clerk)**:

- `CLERK_SECRET_KEY` - Clerk secret key (server-side)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key (client-side)
- `CLERK_WEBHOOK_SECRET` - Clerk webhook signing secret (optional)
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` - Sign-in page URL (default: `/sign-in`)
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL` - Sign-up page URL (default: `/sign-up`)

**Database**:

- `DATABASE_URL` - Postgres connection string (Neon recommended)
- `DIRECT_URL` - Postgres direct connection string (optional, used for migrations)

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

- `ANTHROPIC_API_KEY` - Anthropic API key for Claude integration (optional)

**Monitoring (optional)**:

- `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` - Sentry error monitoring
- `NEXT_PUBLIC_SENTRY_DSN` - Client-side Sentry DSN

**App**:

- `NEXT_PUBLIC_APP_URL` - Application base URL (http://localhost:3000 for dev)
- `CRON_SECRET` - Secret key for authenticating cron job endpoints (optional)

### UI Components

Component structure:

- `app/components/ui/` - Radix UI-based primitives (buttons, dialogs, forms, select, toast, etc.)
- `app/components/` - Shared application components organized by feature:
  - `ai-memory/` - AI memory management components
  - `characters/` - Character display and management components
  - `charts/` - Chart/analytics components (recharts)
  - `modals/` - Modal dialogs
  - `providers/` - Context providers (ThemeCustomProvider)
  - `search/` - Global search components
  - `settings/` - Settings-related components
  - `sharing/` - Conversation sharing components
  - `suggestions/` - AI suggestion components
  - `tags/` - Tag management components
  - `templates/` - Message template components
  - `themes/` - Theme customization components
  - Core: `Avatar.tsx`, `AvatarGroup.tsx`, `Button.tsx`, `EmptyState.tsx`, `ErrorBoundary.tsx`, `icons.tsx`, `SessionsList.tsx`, `site-header.tsx`, etc.
- `app/(dashboard)/dashboard/conversations/components/` - Conversation-specific components (ConversationBox, ConversationList)
- `app/(dashboard)/dashboard/conversations/[conversationId]/components/` - Conversation detail components (Body, ConversationContainer, ExportDropdown, Form, Header, MessageBox, MessageInput, ProfileDrawer, ReplyPreview, TokenUsageDisplay, TypingIndicator, etc.)
- `app/(dashboard)/dashboard/profile/components/` - Profile page tab components (ProfileTabContent, PasswordTabContent, NotificationsTabContent, AccountTabContent)
- `app/(dashboard)/dashboard/usage/components/` - Usage analytics components

Styling: Tailwind CSS with `tailwind-merge` for class merging and `class-variance-authority` for component variants. Theming via `next-themes`.

### Type Definitions

Custom types in `app/types/`:

- `app/types/index.ts` - Core types:
  - `FullMessageType` - Message with sender, seen users, and replyTo populated
  - `FullConversationType` - Conversation with users, messages, character, and tags populated
  - `TagType`, `TagWithCount`, `TAG_COLORS` - Tag types and color definitions
  - `DashboardConfig` - Dashboard navigation configuration
  - `SubscriptionPlan`, `UserSubscriptionPlan` - Stripe subscription plan structures
  - `UserSessionInfo`, `SessionsResponse` - Session management types
  - `MessageTemplateType`, `MessageTemplateWithUsage`, `TEMPLATE_CATEGORIES`, `TEMPLATE_LIMITS`, `TEMPLATE_CONSTRAINTS` - Template types and constants
  - `ConversationShareType`, `ConversationShareWithUrl`, `SharePublicInfo` - Sharing types
  - `CreateShareRequest`, `UpdateShareRequest`, `ShareResponse`, `JoinShareResponse` - Share API types
- `app/types/export.ts` - Export format types
- `app/types/nav.ts` - Navigation types
- `app/types/search.ts` - Search result and filter types

## Common Workflows

### Adding a New API Route

1. Create route handler in `app/api/[route]/route.ts`
2. Use `getCurrentUser()` from `app/actions/getCurrentUser.ts` for authentication
3. Use `prisma` from `app/lib/prismadb.ts` for database operations
4. For real-time updates, trigger Pusher events via `pusherServer` from `app/lib/pusher.ts`
5. For state-changing operations, validate CSRF tokens from headers using `app/lib/csrf.ts`
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
- **Pinning Conversations**: Users can pin important conversations to the top of the list
  - POST `/api/conversations/[conversationId]/pin` - Pin conversation for current user
  - DELETE `/api/conversations/[conversationId]/pin` - Unpin conversation for current user
  - Per-user pin status: Each user has their own pin state for shared conversations
  - `pinnedBy` array stores user IDs who pinned the conversation
  - `pinnedAt` timestamp tracks when first user pinned the conversation
  - Maximum of 5 pinned conversations per user
  - Real-time updates via Pusher `conversation:pin` and `conversation:unpin` events on user-specific channel
  - Pinned conversations appear at the top of the conversation list in their own section
- **Muting Conversations**: Users can mute conversations to silence notifications
  - POST `/api/conversations/[conversationId]/mute` - Mute conversation for current user
  - DELETE `/api/conversations/[conversationId]/mute` - Unmute conversation for current user
  - `mutedBy` array stores user IDs who muted the conversation
- **Conversation Export**: Export conversations in multiple formats
  - GET `/api/conversations/[conversationId]/export` - Export in JSON, Markdown, or plain text
  - Export utilities in `app/lib/export.ts`
- **Conversation Sharing**: Share conversations via public links or invites
  - Sharing utilities in `app/lib/sharing.ts`
  - Token-based access with configurable permissions and expiration
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
  - Real-time updates via Pusher `conversation:auto-delete` event to all conversation participants
  - **Cron Job**: For production, set up a scheduled function to call `runAutoDeleteForAllUsers()` daily via `/api/cron/auto-delete`

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
- **Message Reactions**: Users can react to messages with emoji
  - POST `/api/messages/[messageId]/react` - Add or remove a reaction
  - Reactions stored as JSON in the `reactions` field
- **Message Replies/Threading**: Messages can reply to other messages
  - `replyToId` field links to parent message
  - UI shows reply preview with original message context
- **Message Search**: Search across messages
  - GET `/api/messages/search` - Search messages within conversations
- **Message Constraints**:
  - Cannot edit/delete AI messages
  - Cannot edit already deleted messages
  - Maximum message length: 5000 characters

### Working with User Profiles

- **Profile Management**: Users can edit their profile at `/dashboard/profile`
  - GET `/api/profile` - Fetch current user profile
  - PATCH `/api/profile` - Update profile fields
  - Profile fields: `name`, `bio` (500 chars max), `location` (100 chars max), `website` (URL validated)
  - Tabbed interface: Profile, Password, Notifications, Account
- **Account Deletion**: GDPR-compliant account deletion
  - 30-day grace period before permanent deletion
  - Data anonymization handled by `app/lib/account-deletion.ts`
  - Cron endpoint at `/api/cron/process-deletions` processes pending deletions
  - Email notifications sent at each stage (pending, cancelled, deleted)
- **Validation**: Zod schemas validate all inputs (URL format, character limits, etc.)

### Working with AI Features

- Free tier: 10 messages per month, PRO: unlimited
- AI personalities configured in `app/lib/ai-personalities.ts`
- AI models configured in `app/lib/ai-models.ts`
- Stream AI responses using SSE endpoint `/api/ai/chat-stream`
- Track usage via `app/api/ai/usage/` endpoint with detailed token and cost breakdowns
- AI usage stored in `AiUsage` model with per-request granularity (`app/lib/ai-usage.ts`)
- **AI Memory**: Persistent context across conversations
  - CRUD operations via `/api/ai/memory/` endpoints
  - AI-powered extraction via `/api/ai/memory/extract/`
  - Memory management utilities in `app/lib/ai-memory.ts`
  - Memory limits: 50 (free), 200 (PRO)
- **AI Suggestions**: Get conversation starter suggestions via `/api/ai/suggestions/`
- **AI Regeneration**: Regenerate the last AI response via `/api/ai/regenerate/`

### Working with Characters

- **Character Management**: Users can create custom AI characters
  - CRUD operations via `/api/characters/` endpoints
  - Characters have slugs for URL-friendly identifiers (`app/lib/slug.ts`)
  - Category system for organization (`app/lib/character-categories.ts`)
  - Public marketplace: characters with `isPublic: true` are discoverable
  - Featured characters highlighted in explore page
- **Character Interactions**:
  - Like/unlike via `/api/characters/[characterId]/like/`
  - Favorites list via `/api/characters/favorites/`
  - Usage tracking: `viewCount`, `usageCount`, `lastUsedAt`

### Authentication & Security

- **Authentication**: Handled entirely by Clerk. Email verification, password management, OAuth, and MFA are all managed through Clerk's dashboard and components.
- **Rate Limiting**: Apply to sensitive endpoints using in-memory rate limiters

  ```typescript
  import { authLimiter, getClientIdentifier } from "@/app/lib/rate-limit"

  const identifier = getClientIdentifier(request)
  if (!authLimiter.check(identifier)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }
  ```

  Available limiters: `apiLimiter` (60/min), `authLimiter` (5/5min), `aiChatLimiter` (20/min), `accountDeletionLimiter` (3/hr), `twoFactorLimiter` (5/5min), `tagLimiter` (30/min), `memoryLimiter` (30/min), `memoryExtractLimiter` (5/min), `templateLimiter` (30/min), `shareLimiter` (10/min), `shareJoinLimiter` (5/min)

  **Production note**: All rate limiters use in-memory storage. For production with multiple server instances, implement `IRateLimiter` interface with Redis (example provided in `app/lib/rate-limit.ts`).

- **Email**: Postmark used for transactional emails (welcome, account deletion notifications). Verification and password reset emails are handled by Clerk. Email utilities in `app/lib/email.ts` with templates in `app/lib/email-templates.ts`. Development mode logs emails to console.

### Subscription Integration

- Check user subscription status via `User.stripeCurrentPeriodEnd` field
- Stripe webhooks automatically update user subscription data
- Subscription plans (free/PRO) are defined in `config/subscriptions.ts`
- Use `getUserSubscriptionPlan()` from `app/lib/subscription.ts` to get current plan
- Free plan: 10 AI messages/month, 50 AI memories, basic features
- PRO plan ($20/month): Unlimited AI messages, 200 AI memories, all models, export, sharing, auto-delete

## Important Notes

- **Prisma Client**: Use the singleton instance from `app/lib/prismadb.ts`. It exports both `default` (as `prisma`) and named `db` export. Uses Neon adapter (`@prisma/adapter-neon`) with WebSocket support.
- **No `app/libs/` directory**: Only `app/lib/` exists. All utility files are in `app/lib/`.
- **Route Groups**: Parentheses in directory names like `(dashboard)` are Next.js route groups - they don't appear in URLs
- **UUIDs**: All IDs are UUIDs, use `@db.Uuid` in Prisma schema
- **Real-time**: Pusher channel naming follows pattern: `conversation-${conversationId}` and `user-${userId}`
- **Type Safety**: The project uses TypeScript strictly - always run `bun run typecheck` before committing
- **API Client**: Always use the centralized API client (`app/lib/api-client.ts`) for frontend API requests instead of raw axios
- **Authentication**: Clerk handles all auth flows (sign-in, sign-up, email verification, password reset, OAuth, MFA). No custom auth endpoints exist.
- **Development Emails**: In development mode, emails are logged to console instead of being sent via Postmark
- **Rate Limiting**: Uses in-memory rate limiters. For production with multiple instances, implement `IRateLimiter` interface with Redis (see `app/lib/rate-limit.ts` for Redis example).
- **2FA Tokens**: `app/lib/two-factor-tokens.ts` uses in-memory storage. Not suitable for multi-instance production deployments without replacing with a distributed cache.
- **CSRF Protection**: All POST/PUT/PATCH/DELETE endpoints should validate CSRF tokens via `app/lib/csrf.ts`
- **AI Usage Tracking**: Free users limited to 10 AI messages per month. Detailed per-request tracking in `AiUsage` model with token counts and cost estimation.
- **Server Actions**: Next.js 15 server actions require `'use server'` directive at the top of the file
- **Environment Setup**: See `.env.local.example` for complete setup guide; use `SETUP.md` for service configuration
- **Sentry**: Optional error monitoring via `@sentry/nextjs`. Configure with `SENTRY_*` environment variables.
- **Cron Jobs**: Two cron endpoints protected by `CRON_SECRET`: `/api/cron/auto-delete` (conversation cleanup) and `/api/cron/process-deletions` (GDPR account deletion processing)
- **Next.js Version**: Uses Next.js 16 (`next@^16.1.6`) with App Router

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
