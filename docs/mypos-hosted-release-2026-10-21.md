# myPOS hosted release — 21 October 2026

**Completed:** the existing public site serves the payment-enabled release.
The subsequent [live phone audit](live-phone-audit-2026-10-21.md) also passed;
overall confirmed spend is now 210 ISK across six 35 ISK payments. The release
plan and pre-audit counts below retain their original chronological context.
The release was deployed from the then-uncommitted working tree. The subsequent
22 October repository checkpoint records it in Git with automatic Git deployments
disabled; see the [deployment runbook](deployment.md).

## Release plan

Update the existing public Preview at `https://vegstod.vercel.app`, linked to
Supabase project `Road` (`abpmzqtbllszqqetuubp`). Keep WhatsApp sending manual.
The first fee is 10,490 ISK; dispatch enters the separate second amount.

1. Apply the two tested payment migrations and enable the scheduler extensions.
2. Install server-only merchant credentials and a random worker secret in Vercel
   Preview. Store the matching worker secret and HTTPS origin in Supabase Vault.
3. Deploy the tested working tree, then update the existing public alias.
4. Enable the named minute schedule and verify its actual HTTP results.
5. Check staff/customer screens in a browser, access boundaries, database
   privileges and preservation of existing data. Record the deployed version.

The existing two-payment phone acceptance passed with four provider-confirmed
35 ISK payments across the controlled tests (140 ISK total). No additional
paid test is planned. The latest local verification passed build, types, lint,
469 application tests and 363 database assertions.

## Before release

- Hosted: zero jobs, zero operators, zero assignments and three staff profiles.
- Both payment migrations are absent. Supabase Vault is installed; pg_cron and
  pg_net are available but not installed. No payment worker Vault entries exist.
- Vercel Preview has the existing Supabase configuration and DEMO_MODE only.
- Previous public deployment: `vegstod-ei4u4kort-freyrs-projects-fad4047a.vercel.app`.
- Existing security advisor findings: the private rate-limit table intentionally
  has RLS without public policies; Auth leaked-password protection is disabled.

## Progress

- Release authorized by Freyr: “ok then continue”.
- Hosted migration dry run passed: only the two expected payment migrations.
- Applied migrations `20261020223002` and `20261021201000`, followed by
  `20261021220248_enable_payment_reconciliation_extensions.sql`.
- Installed all payment configuration in Vercel Preview. Client ID, client
  secret and the random worker secret are sensitive server-only variables.
  Collection and production request creation are enabled; fee is `10490` and
  `WHATSAPP_API_ENABLED=false`. Existing Supabase settings are preserved.
- Stored matching worker origin/secret in Supabase Vault; values were never
  printed or written to the repository.
- Vercel build passed, including TypeScript. Deployment ID:
  `dpl_FwCDqd93y9rmEnRmgono7VQUqebB`.
- New deployment: `https://vegstod-gyj57bol4-freyrs-projects-fad4047a.vercel.app`.
  The existing `https://vegstod.vercel.app` alias was updated successfully.
- Enabled `mypos-payment-reconciliation`, schedule `* * * * *` (job ID 1).
  The 22:06 and 22:07 UTC scheduled runs succeeded and returned HTTP 200 with
  `{verified:0, submitted:0, failed:0, reviewRequired:0}`. An independent request
  without the worker credential returned HTTP 401 and `unauthorized`.

## Hosted verification

- Staff sign-in and normal phone-only job creation succeeded through the public
  site. The prepared manual WhatsApp draft used the correct stable HTTPS origin.
  No message was sent during this hosted check.
- A separate unauthenticated browser opened that exact private customer link.
  At 390px, the form showed **10,490 ISK**, separate-service explanation and one
  **Pay and submit** button, with no horizontal overflow.
- Confirming the map location and pressing the button with an empty name showed
  `Full name is required.` and focused that field. No payment request or frozen
  draft was created. Screenshot: ignored
  `output/playwright/mypos-hosted-customer-10490.png`.
- The staff payment panel loaded with automatic-status text and the expected
  pending-customer state. No application console errors occurred; the browser
  reported only GPU readback warnings from the map.
- Revoking the link through the normal staff control made the customer page
  unavailable on reload. The one unsubmitted test job was then removed using
  guards for its exact ID, phone, creation window and absence of payments,
  assignments or photos. Existing accounts and data were preserved.
- An invalid service-summary token showed the safe unavailable page. A clean
  unauthenticated browser requesting `/billing` was redirected to `/login`.
- All three payment tables have RLS. Anonymous callers cannot read them; staff
  have read-only access to requests; frozen drafts and private summary metadata
  remain service-only. Security advisors reported no new warnings: the two new
  service-only tables intentionally have RLS without public policies.
- Cleanup count: zero jobs, operators, assignments, payment requests, frozen
  intakes and service pages; the original three staff profiles remain.
- No additional charges: total controlled-test spend remains **140 ISK**.
- Final hosted database lint passed with no schema errors. The final migration
  dry run reports the remote database is up to date with no pending migrations.
  `git diff --check` passed. The two owned verification browsers were closed.

The deployed application uses the tested source from the current working tree.
At the end of this 21 October release, these changes had not yet been committed
or pushed to GitHub; the 22 October repository checkpoint supersedes that state.

## Rollback

Point `vegstod.vercel.app` back at the previous deployment and unschedule
`mypos-payment-reconciliation` if needed. Keep additive payment tables and any
payment records intact. Disabling new requests must not discard an existing
payment or silently resubmit an ambiguous creation.

Secrets, private customer links and staff credentials belong outside this
document and outside Git.

The subsequent [live phone audit](live-phone-audit-2026-10-21.md) completed two
more controlled 35 ISK payments through the hosted database and this release's
scheduled worker, plus native photo upload/removal and correction checks.
Overall confirmed test spend is now 210 ISK; the release itself made no charge.
The public deployment and ordinary 10,490 ISK fee remain unchanged.
