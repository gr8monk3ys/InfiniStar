# Stripe Staging Webhook Verification

Use this runbook before every payment release and after Stripe credential changes.

## Prerequisites

- Staging deployment is live.
- Staging has `STRIPE_WEBHOOK_SECRET` configured.
- `STAGING_WEBHOOK_URL` points to `/api/webhooks/stripe`.
- Optional: `STRIPE_API_KEY` set (script uses placeholder if omitted).

## Verification Command

```bash
STAGING_WEBHOOK_URL="https://staging.example.com/api/webhooks/stripe" \
STRIPE_WEBHOOK_SECRET="whsec_..." \
npm run ops:stripe:webhook:verify
```

## What The Script Validates

1. A valid Stripe signature returns `200`.
2. An invalid Stripe signature returns `400`.

This confirms both signature acceptance and rejection behavior in staging.

## Expected Output

- `Stripe webhook verification passed: valid signatures accepted and invalid signatures rejected.`

## Failure Handling

1. Check staging env values for `STRIPE_WEBHOOK_SECRET`.
2. Confirm staging URL routes to `/api/webhooks/stripe`.
3. Review staging logs for `Webhook Error` messages.
4. Re-run verification after fix.
