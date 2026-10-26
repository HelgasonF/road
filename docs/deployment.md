# Hosted preview and Supabase operations

Last updated: 26 October 2026

Released reusable driver assignment links: source `2b764af`, migration
`20261026174440`, Ready Preview `dpl_CEeCgGDaE4r6DugtjRJbru5jW7M3`,
`vegstod-bx65py2a8-freyrs-projects-fad4047a.vercel.app`. The stable
`https://vegstod.vercel.app` alias serves this release. The isolated checkout
preserves the payment fix below and excludes unfinished map/editor changes.
New assignment links reopen across browsers until completion, cancellation,
reassignment or disabled access; legacy onboarding links remain one-time. Staff
must generate/send **Búa til verkefnistengil** once. Remote migration history is
current. See the [driver-link release](reusable-driver-links-2026-10-26.md).

Released 26 October: myPOS customer-name compatibility and guarded recovery of
definitively rejected creations. Both `en` and `is` passed real unpaid provider
creation checks after adapting only the provider's display name to Latin text.
The customer's actual name remains in Vegstoð. Migration `20261026115922` is
applied. That payment release used Ready Preview deployment
`dpl_2LXeT3SEcfstuoAX8Vckk6umgJeq`,
`vegstod-q8hdb4e0f-freyrs-projects-fad4047a.vercel.app`, superseded by the driver
release above. Payment source was released
from an isolated `111ae22` checkout plus the fix, excluding existing local
job/location edits. The subsequent user-requested Git checkpoint records the
payment changes on `chore/vercel-git-connection`; pushing does not redeploy.
No card charge was made. See the
[payment investigation/release record](payment-failure-investigation-2026-10-26.md).

Released 23 October: international phone input/display with no default country
and the approved typed-location/actionable-error fix. Migration
`20261023171927_support_typed_customer_locations.sql` was applied before the app
release; remote migration history is current. The final Ready deployment is
`dpl_BXLYy4f24SEWz8dSyHTohgN4jpjX`,
`vegstod-vr1npotdf-freyrs-projects-fad4047a.vercel.app`, from source `88f1e1c`.
That was the 23 October alias target. Phone formatting itself needs no migration;
the original local database remains unmigrated. See the
[audit/release record](phone-location-release-2026-10-23.md).

## Current hosted environment

Vegstoð currently has one external **preview** environment:

- Application: `https://vegstod.vercel.app`
- Vercel project: `freyrs-projects-fad4047a/vegstod`
- Supabase project: `Road`
- Supabase project reference: `abpmzqtbllszqqetuubp`
- Supabase region: `eu-west-1`
- Supabase plan: Free

The live customer site uses Vercel's **Preview** target; the separate Production target is unused. This public Preview has real myPOS collection enabled. It is intentionally public at the network layer so customers and drivers can open their secure links without a Vercel account. Staff routes still require Supabase authentication, customer routes require a random expiring one-time token, driver links establish a restricted Supabase session after explicit confirmation, and the photo bucket remains private.

The hosted database contains the complete migration history and the official Icelandic address/place search data. On 7 October 2026 all test jobs, drivers (operators, vehicles and their driver logins), customer links, billing records, timeline events, job photos and WhatsApp sandbox logs were deleted at the owner's request; a data-only backup taken just before is kept outside the repository in `~/vegstod-backups/`. The only accounts left are the three admins (Freyr, Daldís and Alli), who create further staff on the in-app **Aðgangur** page. At the last check the database used about 94 MB of the Free plan's 500 MB allowance. The imported reference data comprised 139,346 HMS addresses and 2,970 Icelandic place names.

Inventory checked after 23 October release cleanup: **two jobs (one active), zero operators/drivers and three staff profiles**. Existing customer work is preserved; the cancelled audit job and its two real Paid 35 ISK requests remain financial history. Only the new unpaid release fixture was removed. Overall controlled-test spend remains **210 ISK across six payments**; ordinary first pricing remains **10,490 ISK**. No payment or message was created by this release. The company owner will add the actual drivers/providers. See the [completed payment phone audit](live-phone-audit-2026-10-21.md) and [23 October release](phone-location-release-2026-10-23.md).

Customer intake stores the selected or customer-entered vehicle make, optional rental-company name, number of people involved, required assistance, and written description. The default new-job path creates a pending job from only the phone number and prepares a private customer link and WhatsApp message for staff to copy and send in the Business app. Staff can switch to the complete manual form, which uses the same registration, brand, rental-company, and people-count fields. With collection enabled, **Pay and submit** freezes the details before myPOS checkout, and the trusted worker finalizes the draft after matching Paid; the customer need not return. A requested correction after the first payment uses **Send details securely** without charging again. The unpaid submission path remains available with collection disabled. See [myPOS setup](MYPOS_SETUP.md) and the current [manual WhatsApp handoff](manual-whatsapp-handoff-2026-09-26.md).

The automatic Git Preview completed the full hosted dispatcher → customer → driver → billing workflow on 6 September 2026. A follow-up on commit `ba61a50` verified the replacement passwordless WhatsApp driver links through provider and job creation, assignment handoff, clean-session redemption, one-time reuse rejection, returning access, driver acceptance, and immediate disable. A final physical-phone pass used installed WhatsApp, GPS, the native photo picker, the one-time driver link, private-photo display, every driver status, the staff timeline, and billing handoff over public HTTPS. On 7 September, Alli completed another real WhatsApp customer and driver pass; the reported portrait-thumbnail cropping was corrected and the same job was reassigned to the owner's test driver for verification. The later phone-first audit proved that **+** now needs only a phone number, the customer can select assistance and write a description, and submission unlocks the normal map, matching, and assignment flow. See [`docs/hosted-audit-2026-09-06.md`](hosted-audit-2026-09-06.md), [`docs/hosted-whatsapp-driver-audit-2026-09-06.md`](hosted-whatsapp-driver-audit-2026-09-06.md), [`docs/public-phone-audit-2026-09-06.md`](public-phone-audit-2026-09-06.md), [`docs/alli-live-demo-2026-09-07.md`](alli-live-demo-2026-09-07.md), and [`docs/hosted-phone-first-intake-audit-2026-09-07.md`](hosted-phone-first-intake-audit-2026-09-07.md).

The initial real admin is active and its login was verified against the preview. Its simplified testing credentials are stored outside the repository at `~/.config/vegstod/first-admin.json` with owner-only file permissions. The password must never be committed and must be replaced with a unique production password before launch.

## Vercel configuration

The Preview and Production environments contain these encrypted base variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
DEMO_MODE=false
```

On 21 October, Freyr authorized myPOS collection on the existing public Preview.
`vegstod.vercel.app` now points to
`vegstod-bx65py2a8-freyrs-projects-fad4047a.vercel.app` after the 26 October
driver-link release, preserving that day's payment fix. Payment configuration is
installed in **Preview**; the unused Production target remains unchanged.
Server-only sensitive variables hold the merchant Client ID/Secret and
`PAYMENT_WORKER_SECRET`. Collection and production API creation are enabled,
the initial fee is `10490` ISK, and `WHATSAPP_API_ENABLED=false` preserves manual
messaging. Local defaults remain disabled.

Hosted migrations `20261020223002`, `20261021201000`, `20261021220248`,
`20261023171927`, `20261026115922` and `20261026174440` are applied. The last
adds reusable assignment credentials and revocation triggers. The third enables
pg_cron and pg_net; it creates no
schedule or secret. The fourth permits searched customer locations and grants
server-only catalog access, preserving existing table structures and payment flow.
The separately applied `supabase/ops/schedule-payment-reconciliation.sql` invokes
the worker every minute using the HTTPS origin and matching secret in Supabase
Vault. Scheduled HTTP 200 results, rejection without the secret, browser checks
and fixture cleanup are recorded in the [hosted release record](mypos-hosted-release-2026-10-21.md).

`SUPABASE_SECRET_KEY` must remain server-only and must never use a `NEXT_PUBLIC_` prefix. It performs validated customer-link/Storage and payment operations, plus reusable assignment sign-in after hashed-credential/state validation. Staff driver provisioning/access management remains in `driver-access-v1`. No server credential or fresh internal OTP is sent to browser code. The local `.vercel/` metadata is ignored by Git.

On 11 September 2026, the local environment and both Vercel targets were refreshed to the current hosted Supabase publishable and server keys after an older retired publishable key was detected. A new Vercel deployment is required whenever these values change because public Next.js variables are embedded at build time.

Create a new preview from the linked working tree with:

```bash
npx vercel deploy --target preview
```

Point the stable phone-test address at the new deployment after it is Ready:

```bash
npx vercel alias set DEPLOYMENT_URL vegstod.vercel.app
```

Do not use `--prod` until the external phone workflow and the production checklist have been approved. Production variables are prepared, but there is no active production deployment.

## GitHub backups and manual deployments

Freyr requested a clean Git checkpoint and push on 22 October **without another
deployment**. This checkpoint records the tested live source, payment migrations,
tests and documentation together on `chore/vercel-git-connection`. On 23 October,
Freyr explicitly authorized auditing, deploying and synchronizing the new
phone/location work. Source `88f1e1c` was deployed manually as
`dpl_BXLYy4f24SEWz8dSyHTohgN4jpjX`. The current 26 October driver-link source
is `2b764af`, deployed manually as `dpl_CEeCgGDaE4r6DugtjRJbru5jW7M3`.
Git deployment remains disabled.

Vercel remains connected to the private GitHub repository `HelgasonF/road`.
The repository's [vercel.json](../vercel.json) sets
`git.deploymentEnabled=false`, disabling automatic deployments for commits that
contain this configuration. This uses Vercel's documented
[Git deployment control](https://vercel.com/docs/project-configuration/git-configuration#turning-off-all-automatic-deployments).
Keep that file when creating or merging branches. Older branches without it can
still trigger their previous automatic-deployment behavior. The configured
Production branch remains `main`; this checkpoint does not merge into it.

```bash
git push origin chore/vercel-git-connection
```

Use the explicit Preview deployment and stable-alias commands above for an
authorized release. A normal Git push of this configuration is a source backup,
not a deployment. Do not remove the control or switch it to `true` unless
automatic deployments are deliberately being restored.

If Vercel loses repository access, open [GitHub installed applications](https://github.com/settings/installations), configure the Vercel application, and confirm that its repository access includes `road`. Also confirm GitHub appears in [Vercel Login Connections](https://vercel.com/account/settings/authentication), then reconnect with `npx vercel git connect --yes`. Vercel documents these permissions in its [GitHub repository guide](https://vercel.com/docs/git/vercel-for-github#missing-git-repository).

## Supabase configuration

The repository is linked to the hosted project. Check and apply migrations with:

```bash
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
npx supabase functions deploy driver-access-v1
npx supabase functions deploy whatsapp-webhook-v1 --no-verify-jwt
npx supabase functions deploy whatsapp-management-v1
npx supabase functions deploy whatsapp-send-v1
```

The hosted Auth Site URL is `https://vegstod.vercel.app`. Its allowed redirect URLs also include that address plus local `127.0.0.1:3000` and `localhost:3000` development URLs. Email/password authentication and TOTP remain available for staff accounts. Public self-signup is disabled, staff passwords require at least 10 characters with letters and digits, and public users do not receive database function execution privileges. Hosted PostgreSQL rejects non-SSL external connections.

Drivers do not receive email or create passwords. Staff provisioning uses
`driver-access-v1` with the caller's token and an explicit staff check. New
assignment links store only a random credential's hash in `driver_assignment_links`.
Dispatch manually sends the first-party path. **Opna ökumannsskjá** validates
current state before reusing/creating the ordinary restricted driver session.
The same link works after closing/changing browsers or losing login. Completion,
cancellation, reassignment and disabled provider access permanently revoke it.
Old onboarding tokens remain one-time. No SMTP or global Auth-expiry change is
needed. Payment/operational functions and existing account permissions remain.

The Realtime publication contains only `jobs`, `job_assignments`, and `operators`. RLS still filters future subscribers. The Next.js app does not subscribe. The payment panel polls verified database state every 15 seconds while visible and awaiting intake/payment completion; the separate worker checks myPOS about once per minute. Other operational changes retain the existing request/refresh behavior.

### WhatsApp Cloud API webhook

This section describes the retained API backend and its historical verification.
Current customer, service-payment and driver messages are sent manually in the
Business app; the dashboard does not invoke the paused API sender.

Meta's production callback is the public, versioned Edge Function below:

```text
https://abpmzqtbllszqqetuubp.supabase.co/functions/v1/whatsapp-webhook-v1
```

The function intentionally disables Supabase JWT verification because Meta is the caller. Its own controls authenticate the two webhook phases: `WHATSAPP_WEBHOOK_VERIFY_TOKEN` must match the setup challenge, and `WHATSAPP_APP_SECRET` verifies the `X-Hub-Signature-256` HMAC over the unchanged request body before any payload is accepted. Both values are Supabase Edge Function secrets and must never enter Vercel, client code, Git, screenshots, or documentation.

Signed deliveries are deduplicated by a SHA-256 hash of the raw request and stored in `whatsapp_webhook_events`. The same transaction normalizes delivery updates into `whatsapp_delivery_events`, inbound messages into `whatsapp_inbound_messages`, and links them to `whatsapp_outbound_messages` by Meta message ID. Explicit `STOP`/`HÆTTA` and `START`/`BYRJA` messages update one `whatsapp_contact_preferences` row per normalized phone; its effective timestamp prevents a delayed older webhook from overwriting a newer choice. Only the Edge Function service role can write; authenticated staff can read through RLS; drivers and anonymous callers cannot read or write these records. A failed database write returns a retryable response so Meta can redeliver it.

`whatsapp-send-v1` is the staff-only outbound boundary. It normalizes Icelandic seven-digit numbers to E.164 digits, uses a purpose-specific approved template, reserves a UUID idempotency key, rejects an opted-out recipient before provider delivery, and records the Meta message ID. The ledger stores only a SHA-256 fingerprint of the final provider payload, so customer and driver bearer links are not recoverable from it. A definite 4xx rejection can be retried with the same key and identical payload. Network failures, 5xx responses, and incomplete success responses require review and are never retried automatically.

The generic Meta sandbox outbound test passed on 11 September 2026. The callback challenge is deployed and verified directly over hosted HTTPS. The Meta App Secret and permanent access token are installed only in Supabase secrets, the app is subscribed to the sandbox WABA, and the `messages` webhook field is subscribed. `whatsapp-management-v1` performed that setup only after a hosted staff session passed `is_staff()`; it returned no credentials. A fresh physical-phone reply then arrived as one signed `messages` event for the expected WABA and was stored in the hosted staff-only inbox. Three API-created `vegstod_*` templates were later found to have incorrect branding and configuration and were deleted in Meta. Their creation action has been removed from `whatsapp-management-v1`. The deployed interface now names the manually reviewed `iceland_road_assistance_*` replacements and safely returns to its manual action when Meta rejects or cannot deliver a template. See [`whatsapp-production-handoff-2026-09-12.md`](whatsapp-production-handoff-2026-09-12.md) for the exact definitions and current review boundary.

The historical sandbox sender is `+1 555-601-6830` (Phone Number ID `1251932438011191`) in test WABA `1799725827819599`. Cloud API sending is paused. The owner's `+354 853 7704` number remains in the WhatsApp Business phone app for calls and manually sent messages. Dispatch prepares customer and driver messages in Vegstoð, then copies and sends them from that Business account. The server-side `WHATSAPP_API_ENABLED` switch defaults to false; no current UI action calls the API sender. Do not delete the phone-app account or switch Supabase sender secrets. See the current [manual WhatsApp handoff](manual-whatsapp-handoff-2026-09-26.md); the earlier [API handoff](whatsapp-production-handoff-2026-09-12.md) is preserved for later work.

The following values are server-only Supabase secrets: `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, and `WHATSAPP_WEBHOOK_VERIFY_TOKEN`. The app ID, sandbox WABA ID, production WABA ID, active Phone Number ID, Graph API version, and each purpose-specific template name/language are also configured there so one runtime owns the complete Meta configuration. The production WABA ID remains separate from the active sandbox sender until cutover. Never place any of these values in a browser bundle or commit their values.

Use `Atlantic/Reykjavik` (`UTC+00:00`) when Meta asks for the business or WABA time zone. PostgreSQL stores all operational and webhook instants as `timestamptz`; Meta Unix timestamps are converted to UTC ISO instants, and Vegstoð displays them on Iceland's year-round UTC clock.

Create each additional staff user in Supabase Auth, then activate it explicitly:

```sql
update public.profiles
set role = 'admin'
where email = 'dispatcher@example.com';
```

New users remain `pending` by default. Never grant staff access by changing the default role.

## Address refresh

Run the importer against hosted PostgreSQL only with a protected direct connection string:

```bash
DATABASE_URL='postgresql://…' npm run addresses:import
```

The source files are downloaded at run time and are not committed. Refresh the HMS data weekly. Keep the existing data until the replacement transaction completes.

## Verification before a production release

Run the repository checks:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx supabase test db
npx supabase db lint --local --schema public
```

For future operational changes, repeat the relevant customer/driver workflow on a physical phone over the public site: staff sign-in, **+**, phone-only creation, manual customer WhatsApp handoff, details/location/photos, **Pay and submit**, trusted Paid confirmation and matching unlock, dispatcher receipt, a separate dispatcher-entered service summary/payment, assignment, driver WhatsApp access-link confirmation, private-photo access, status changes, timeline and billing handoff. Confirm an active assignment link reopens in a clean browser, fails after completion/cancellation/reassignment, and disabling the driver removes existing access immediately. Legacy onboarding links should still reject reuse in a clean session. Use the zero-cost test suite for repeatable payment checks; additional real-card tests require authorization within the remaining budget. Remove owned disposable records, users and Storage objects afterward while retaining actual financial records. The completed 21 October audit covered customer/payments/photos; it did not repeat driver assignment and progression.

## Moving from Free to paid Supabase

Upgrade the existing `Road` project in the Supabase organization when its limits, uptime requirements, backup requirements, or launch schedule justify it. Keeping the same project preserves its project reference, API URL, database, Storage objects, and Vercel environment variables; a second database migration is unnecessary. Review the current [Supabase billing documentation](https://supabase.com/docs/guides/platform/billing-faq) before upgrading.

The project region cannot be changed in place. If a different region is required later, plan a separate project migration. Also configure backups, monitoring, and the final domain before declaring the environment production-ready. Supabase documents the relevant launch checks in its [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).
