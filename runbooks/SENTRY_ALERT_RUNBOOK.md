# Sentry Alert Runbook

This runbook standardizes issue-alert coverage in Sentry.

## Required Baseline

- At least 2 active issue alert rules
- At least 1 critical/P0 rule (name contains `critical`, `p0`, `sev0`, or `sev1`)
- Active rules include notification actions (Slack/email/PagerDuty/etc.)

## Audit Command

```bash
SENTRY_AUTH_TOKEN="sntrys_..." \
SENTRY_ORG="your-org" \
SENTRY_PROJECT="your-project" \
npm run ops:sentry:alerts:audit
```

## Audit Outcome

- Pass: baseline coverage met.
- Fail: missing rules/actions/critical tier.

## Remediation Steps

1. Create or update issue alert rules in Sentry project settings.
2. Ensure each critical rule has an on-call action target.
3. Re-run `npm run ops:sentry:alerts:audit` until passing.
4. Capture output in release evidence.
