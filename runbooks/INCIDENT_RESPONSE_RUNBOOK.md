# Incident Response Runbook

## Severity Levels

- `SEV1`: User-facing outage, payments broken, data loss/security risk
- `SEV2`: Major feature degradation with workaround
- `SEV3`: Minor degradation/non-critical bug

## First 15 Minutes

1. Declare incident and assign:
   - Incident commander
   - Communications lead
   - Primary responder
2. Capture start time and impacted systems.
3. Stabilize:
   - Pause risky deploys
   - Enable mitigations/feature flags
4. Publish first status update.

## During Incident

- Update status every 15 minutes for `SEV1`, every 30 minutes for `SEV2`.
- Track actions and timestamps.
- Prioritize containment before root cause depth.

## Resolution

1. Confirm service health restoration.
2. Monitor for 30 minutes after fix for regression.
3. Publish final status with exact recovery time.

## Postmortem (within 48 hours)

- Timeline of key events
- Root cause and contributing factors
- User impact metrics
- Corrective actions with owners + due dates
