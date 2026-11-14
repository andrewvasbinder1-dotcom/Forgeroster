# Production operations

Pages publishes the public client. Deploy database and worker code separately.

## Hosted setup and verification

1. Take and verify a project backup in Supabase, then test restore using a staging project. Backup availability and restoration were not verified in this workspace.
2. Apply `supabase/rosters.sql`, `supabase/combat_scenarios.sql`, `supabase/operations.sql`, and `supabase/admin_directory.sql` in that order. Never drop existing tables to roll back. Disable the worker first and revert the Pages commit if needed. Revoke the new RPC grants while investigating. Preserve bug, audit and outbox records.
3. As the project database administrator, insert the chosen existing user's verified UUID into `forge_private.admins(user_id)`. Obtain it from the project's Authentication users page. Do not provision by a browser-supplied email. Prefer MFA for administrator accounts.
4. Use two test accounts plus an administrator. Confirm guests cannot submit or read reports, a signed-in ordinary user can submit but cannot read reports or call mutation/overview RPCs, and only the admin can retrieve a screenshot or update a report. Verify status changes create rows in `forge_private.audit`. Test with a small PNG, malformed image and over-limit submissions. Also verify registration, recovery, session refresh, cross-device roster editing and conflicts, and combat scenario isolation using actual sessions.
5. Visit `#admin` on the published website. The link is public and the data is protected by the database.

## Developer email

The report transaction enqueues notifications regardless of provider availability. After the owner supplies the destination address, apply `supabase/email_worker.sql`, deploy the `bug-email` Edge Function and configure a verified Resend sender, `FORGE_NOTIFICATION_EMAIL`, `FORGE_FROM_EMAIL`, `RESEND_API_KEY`, and a random `FORGE_WORKER_TOKEN` of at least 32 characters. Keep credentials and the invocation header in server-side secrets. Configure a private scheduled POST using that token. The worker processes one queued notification per invocation. The idempotency key is the report UUID. Retries stop after five attempts or before the provider's idempotency window expires. The dashboard counts provider acceptance separately from pending and failed events. Check actual inbox delivery using a test report. No hosted worker, scheduler or inbox delivery has been verified.

## Points audit

Run `node scripts/verify-points.mjs points.csv` for the existing comparison checklist. Optionally supply an independently transcribed official snapshot JSON as the second argument. Its shape is `{source, revision, rows:[{faction,unit,tier,option,models,points}]}`. Record entries needing interpretation separately. The report describes matches to the supplied transcription and does not attest to who created it. Keep old catalogue revisions in Git and tag releases. Saved roster snapshots record edition and revision on the next edit without altering existing selections.

## Current gaps

Only installed rules packs with structured data can enforce detailed composition and equipment checks. Faction-wide legal loadouts, allied-unit permissions, full row-by-row official comparison and remaining original rules summaries require primary material. No hosted access was available to run privileged SQL or end-to-end authenticated tests. The dashboard supports bug triage, private attachments, aggregate counts and report update auditing. Account suspension and role management, rules publishing and rollback UI, error telemetry, announcements, feature flags and self-service account deletion are outstanding. Screenshots are capped and re-encoded by the UI. The database checks the PNG signature, declared header and byte length. The schema does not provide antivirus scanning.
