# Migration Guide - Recent Fixes

This document outlines all the critical fixes applied to InfiniStar and what you need to know.

## What Was Fixed

### 🔴 Critical Infrastructure Issues

1. **Duplicate Directory Consolidation**

   - **What:** Removed conflicting `/app/libs/` directory
   - **Impact:** All imports now consistently use `/app/lib/`
   - **Action Required:** None (already updated)

2. **Environment Variables**

   - **What:** Added missing Pusher and Google OAuth variables
   - **Impact:** Real-time features and Google login now work
   - **Action Required:** Update your `.env.local` with new variables (see SETUP.md)

3. **Authentication Session**
   - **What:** Added NextAuth callbacks to populate `user.id`
   - **Impact:** Session now includes user ID for API authorization
   - **Action Required:** None (automatic)

### 🟠 Core Feature Fixes

4. **Real-time Messaging**

   - **What:**
     - Created Pusher auth endpoint at `/api/pusher/auth`
     - Added Pusher event triggers to messages API
     - Added Pusher event triggers to conversations API
   - **Impact:** Messages and conversations now update in real-time
   - **Action Required:** Configure Pusher credentials in `.env.local`

5. **Type Safety**

   - **What:** Fixed all TypeScript errors and inconsistencies
   - **Impact:** Code now passes `npm run typecheck`
   - **Action Required:** None

6. **Code Deduplication**
   - **What:** Removed duplicate components, hooks, and actions
   - **Impact:** Cleaner codebase, smaller bundle size
   - **Action Required:** None (imports auto-updated)

### 🟡 Quality Improvements

7. **Input Validation**

   - **What:** Added Zod validation to registration endpoint
   - **Impact:** Better error messages, duplicate email prevention
   - **Action Required:** None

8. **Stripe Webhooks**

   - **What:** Fixed invoice payment webhook to use customer ID
   - **Impact:** Recurring payments now update user subscriptions correctly
   - **Action Required:** Test with Stripe CLI

9. **Navigation Routes**

   - **What:** Fixed conversation routes to use `/dashboard/conversations`
   - **Impact:** Navigation now works correctly
   - **Action Required:** None

10. **ProfileDrawer Integration**
    - **What:** Connected info button to ProfileDrawer modal
    - **Impact:** Users can now view conversation details
    - **Action Required:** None

## Breaking Changes

### None!

All fixes are backward compatible. Existing functionality is preserved.

## New Requirements

### Environment Variables

Add these new variables to your `.env.local`:

```bash
# Google OAuth (if using)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Pusher (required for real-time features)
PUSHER_APP_ID=your-pusher-app-id
PUSHER_SECRET=your-pusher-secret
NEXT_PUBLIC_PUSHER_APP_KEY=your-pusher-key
NEXT_PUBLIC_PUSHER_CLUSTER=us2
```

See [SETUP.md](SETUP.md) for detailed setup instructions.

## File Changes Summary

### New Files

- `/app/api/pusher/auth/route.ts` - Pusher authentication endpoint
- `/app/lib/pusher.ts` - Consolidated Pusher configuration
- `/SETUP.md` - Comprehensive setup guide
- `/MIGRATION.md` - This file

### Modified Files

- `/app/lib/auth.ts` - Added session callbacks
- `/app/api/messages/route.ts` - Added Pusher triggers
- `/app/api/conversations/route.ts` - Added Pusher triggers
- `/app/api/register/route.ts` - Added input validation
- `/app/api/webhooks/stripe/route.ts` - Fixed invoice handler
- `/app/layout.tsx` - Added AuthContext and ToasterContext
- `/env.mjs` - Added Pusher and Google OAuth variables
- `.env.template` - Added new variable sections
- `package.json` - Added postinstall script

### Deleted Files

- `/app/libs/` - Entire directory (consolidated to `/app/lib/`)
- `/app/types/index.d.ts` - Conflicting type definitions
- `/app/(dashboard)/dashboard/actions/getConversations.ts` - Duplicate
- `/app/(dashboard)/dashboard/actions/getUsers.ts` - Duplicate
- `/app/(dashboard)/dashboard/components/Avatar.tsx` - Duplicate
- `/app/(dashboard)/dashboard/components/AvatarGroup.tsx` - Duplicate
- `/app/(dashboard)/dashboard/components/Button.tsx` - Duplicate
- `/app/(dashboard)/dashboard/components/EmptyState.tsx` - Duplicate
- `/app/hooks/useActiveList.ts` - Duplicate
- `/app/hooks/useOtherUser.ts` - Duplicate

### Renamed Files

- `/config/dashbboard.ts` → `/config/dashboard.ts` - Fixed typo

## Testing Checklist

After pulling these changes:

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Update Environment**

   ```bash
   cp .env.template .env.local
   # Add your credentials
   ```

3. **Generate Prisma Client**

   ```bash
   npx prisma generate
   ```

4. **Type Check**

   ```bash
   npm run typecheck
   # Should pass with no errors
   ```

5. **Build**

   ```bash
   npm run build
   # Should complete successfully
   ```

6. **Test Core Features**
   - [ ] User registration with email/password
   - [ ] Login with credentials
   - [ ] Google/GitHub OAuth (if configured)
   - [ ] Create conversation
   - [ ] Send message
   - [ ] Real-time message delivery (open in 2 tabs)
   - [ ] Profile drawer opens
   - [ ] Navigation works

## Database Migrations

No database migrations required. The Prisma schema is unchanged.

## API Changes

### New Endpoints

**POST `/api/pusher/auth`**

- Authenticates Pusher presence channels
- Requires authenticated user
- Returns Pusher auth response

### Modified Endpoints

**POST `/api/register`**

- Now validates input with Zod
- Returns 422 for validation errors
- Returns 422 for duplicate emails

**POST `/api/messages`**

- Now triggers Pusher events for real-time updates
- Now includes `image` field when creating messages

**POST `/api/conversations`**

- Now triggers Pusher events for real-time updates

**POST `/api/webhooks/stripe`**

- Fixed `invoice.payment_succeeded` handler
- Now uses customer ID for user lookup

## Pusher Event Structure

### Messages

**Event:** `messages:new`
**Channel:** `{conversationId}`
**Data:** Full message object with sender and seen users

**Event:** `conversation:update`
**Channel:** `{userEmail}`
**Data:** Conversation update with new messages

### Conversations

**Event:** `conversation:new`
**Channel:** `{userEmail}`
**Data:** Full conversation object with users

## Common Migration Issues

### "Cannot find module @/app/libs/..."

**Cause:** Old import paths
**Fix:** Imports have been updated to `/app/lib/`, but if you have uncommitted changes, update them

### "Options object must provide a cluster"

**Cause:** Missing Pusher environment variables
**Fix:** Add `NEXT_PUBLIC_PUSHER_CLUSTER=us2` to `.env.local`

### TypeScript errors about missing types

**Cause:** Prisma Client not generated
**Fix:** Run `npx prisma generate`

### Real-time features not working

**Cause:** Pusher not configured
**Fix:** Add all Pusher environment variables and restart dev server

## Rollback Instructions

If you need to rollback (not recommended):

```bash
git log --oneline  # Find commit before fixes
git revert <commit-hash>
```

However, this will break the application as the original code had critical bugs.

## Support

If you encounter issues after migration:

1. Check this migration guide
2. Review [SETUP.md](SETUP.md) for configuration
3. Check [TODO.md](TODO.md) for known issues
4. Verify all environment variables are set
5. Run `npm run typecheck` to check for errors

## What's Next

See [TODO.md](TODO.md) for remaining improvements and planned features.

The app is now fully functional with all critical issues resolved!
