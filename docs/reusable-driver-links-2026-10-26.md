# Reusable driver assignment links — 26 October 2026

Freyr approved keeping the same assignment link usable until the job closes,
including after closing/changing browsers or losing the login. Current links
are one-time Supabase login tokens, so increasing their expiry would not enable
repeated sign-in. Preserve unrelated local map/editor changes and existing
provider onboarding, operational transitions, payments and manual WhatsApp.

## Implementation plan

1. Issue a random assignment credential, storing only its hash. Bind it to the
   exact assignment, provider and provisioned driver account. Staff alone create
   or replace it; replacement revokes the previous credential.
2. Require an explicit button press before authenticating. A server-only,
   rate-limited lookup checks assignment/job/provider state before fresh login.
   Recheck after sign-in. Reopening a valid link reuses an existing matching
   session, or establishes a new ordinary driver session without an email/SMS.
3. Completion, cancellation, unassignment/reassignment and disabled provider
   access close the credential. State changes permanently revoke it so reopening
   a job or re-enabling a provider cannot revive an old link. Existing driver
   authorization remains in force; a link cannot authenticate a staff account.
4. Open the intended authorized job in the driver workspace. Keep legacy
   onboarding paths working and update only assignment-message link creation.
5. Verify repeat opening, fresh-browser sign-in, closure/reassignment/disable,
   access boundaries, target selection and backward compatibility. Test schema
   changes in a disposable local database. Release only the reviewed driver-link
   source, preserving other in-progress changes.

Server Auth administration for this capability is performed only after checking
the hashed assignment credential and account identity. The service key remains
server-only. Link generation/verification must never send email, SMS or WhatsApp.

## Completed implementation and verification

The assignment's **Búa til verkefnistengil** control now creates a reusable
credential, with updated manual WhatsApp text. `/driver/access?assignment=...`
requires explicit confirmation and opens the intended authorized job. Existing
provider-onboarding and legacy WhatsApp button-code links retain their current
one-time behavior. Already sent one-time links cannot be converted: generate and
send a new assignment link from the assigned job once. The provider access panel
explains this distinction.

Only credential hashes are stored in the new service-only table. Staff issuance
uses the existing staff-authenticated Edge Function to provision a missing driver
account; an existing linked account needs no new provisioning. Reopening uses
server-side Auth administration only after credential/state validation. It
creates and immediately verifies a fresh internal OTP without sending email/SMS.
The ordinary driver role/RLS and availability/status controls remain unchanged.

- Isolated release based on `e13d642`, excluding the pre-existing job-editor,
  address-search and map-test changes. Build, typecheck, lint and **585 application
  tests** pass (27 opt-in tests skipped).
- **24 integration/concurrency tests and 431 pgTAP assertions** pass in a
  disposable clone. The 27 new database assertions cover repeat lookup,
  restricted issuance/resolution, replacement and permanent closure. Original
  local database schema/history remain unchanged.
- Real browser acceptance used disposable PostgreSQL/PostgREST and a separate
  real Supabase Auth container, plus the actual Next app/server actions. Staff
  created the link through the UI. Two clean browsers independently signed in;
  returning through the first session generated **zero** additional Auth calls.
  Both opened the intended job even with another newer job in the list.
- The driver used **Samþykkja → Leggja af stað → Kominn á staðinn → Ljúka verkefni**.
  Completion revoked the credential. Both a signed-out and an already signed-in
  browser then received the closed-link message, with zero login-generation or
  verification calls. Normal layouts passed 320/390/1280px.
- No payment, email, SMS or WhatsApp message was created. Test evidence is ignored
  under `output/driver-link-browser-20261026/` and `output/playwright/`.
- Driver browser contexts reported zero console errors. The staff test proxy
  deliberately excludes Realtime, producing WebSocket 404 retries; other staff
  application errors were absent. Realtime behavior was not part of this test.

## Release progress

**Released:** source `2b764af` is committed/pushed and deployed as Ready Preview
`vegstod-bx65py2a8-freyrs-projects-fad4047a.vercel.app`
(`dpl_CEeCgGDaE4r6DugtjRJbru5jW7M3`, created 18:07 UTC).
`https://vegstod.vercel.app` points to this deployment. The isolated checkout
matches that commit exactly; unrelated map/editor work remains local.

Migration `20261026174440_reusable_driver_assignment_links.sql` is applied to
hosted Road. The dry run identified only that migration and the final dry run is
current. Table read/issuer privileges remain closed to anonymous callers;
resolution is service-only. Security advisors add one expected informational
RLS/no-policy finding for the service-only credential table, with no new warning.

Hosted browser checks passed the new form, server rejection of an unknown
credential, legacy confirmation compatibility and 320/390/1280px without console
errors/warnings. No real driver sign-in, job mutation, payment or message was
performed against hosted data. Successful two-browser sign-in and completion
were verified against the separate real Auth/database copy described above.
Owned test browser sessions, containers/database and temporary Auth state were
removed; the original local database remains unmigrated.
Documentation checks pass 31 Markdown files and 163 local links with balanced
fences; `git diff --check` passes. Payment reconciliation remains active with
HTTP 200. Final notes are a Git-only checkpoint; automatic deployment stays off.

Hosted baseline: five jobs (two active), one operator/driver, three staff, one
assignment and six payment requests. These counts are unchanged after release;
the new credential table is empty until staff generate the first real link. Previous
Ready deployment is `vegstod-q8hdb4e0f-freyrs-projects-fad4047a.vercel.app`
(`dpl_2LXeT3SEcfstuoAX8Vckk6umgJeq`). Git automatic deployment remains disabled.

Apply the additive migration before the new app. It adds the credential table,
a staff-only issuer, server-only resolver and private revocation triggers;
existing operational/payment functions are not replaced. Rollback can restore
the previous app alias while retaining the new empty/history table. Preserve
existing jobs, accounts and payments.
