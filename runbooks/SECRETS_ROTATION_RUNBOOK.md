# Secrets Rotation Runbook

This runbook defines how to rotate production secrets for InfiniStar without downtime.

## Scope

- Clerk keys
- Stripe API/webhook keys
- Postmark token
- Pusher secret
- Database credentials
- Redis credentials
- Sentry auth tokens
- `CRON_SECRET`

## Rotation Cadence

- Standard cadence: every 90 days
- Immediate rotation triggers:
  - Credential leakage/suspected compromise
  - Team member offboarding with privileged access
  - Third-party breach advisory

## Rotation Procedure

1. Prepare
   - Open a maintenance ticket and assign owner + reviewer.
   - Export current env vars from staging and production.
   - Confirm rollback owner and communication channel.
2. Generate new credentials
   - Create new key/token in provider dashboard.
   - Keep old secret active during overlap window where possible.
3. Update staging first
   - Apply new secret in staging environment variables.
   - Redeploy staging and run:
     - `npm run ci:release:gate`
     - `npm run ops:stripe:webhook:verify` (for Stripe changes)
4. Validate staging
   - Auth login flows work.
   - Payments + webhook events process.
   - Realtime messaging remains healthy.
   - Emails send successfully.
5. Update production
   - Apply same secret changes in production.
   - Redeploy.
   - Run targeted smoke checks.
6. Decommission old credentials
   - Revoke old secret/token after confirmation window.
   - Record revocation timestamp in ticket.
7. Close out
   - Attach validation evidence/logs.
   - Update the next rotation due date.

## Rollback

- If errors appear after cutover:
  - Reapply previous known-good secret.
  - Redeploy immediately.
  - Open incident thread and capture impact window.

## Required Evidence

- Ticket ID + owner
- Timestamp of staging and prod cutovers
- Validation command outputs
- Timestamp old secret revoked
