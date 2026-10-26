# Payment preparation failure investigation — 26 October 2026

Initial scope: explain the two screenshots in Freyr's email titled **Vegstod** sent at
11:29 UTC. Read-only investigation of hosted Road and the payment provider;
no application deployment, database mutation, checkout creation or message send.

The follow-up below records Freyr's subsequent request to identify and fix the
cause, including controlled unpaid provider probes and the implementation.

## Confirmed sequence

All times are UTC on 26 October 2026.

1. **09:13:34:** staff created the original customer intake link.
2. **09:27:31:** the customer submitted the initial **10,490 ISK** checkout in
   Icelandic. The application persisted a private draft and payment reservation.
   Creation ended in `creation_failed` with `payment_provider_rejected`. The
   record has no provider code, payment URL, verification or Paid timestamp;
   the intake remains pending.
3. **09:37:01:** staff issued a replacement customer link, revoking the original.
   The replacement link has no payment draft associated with it.
4. **09:38:38:** the customer retried. Hosted PostgreSQL logged
   `payment_details_locked` from body line **40** of
   `prepare_customer_payment_intake`. Inspection of the deployed function
   confirms this is the existing-payment-reservation branch, rather than the
   separate changed-draft-details branch.

The staff screenshot's **Undirbúningur mistókst** is the label for
`creation_failed`. The customer screenshot's **This payment is already
prepared...** is the generic message for `payment_details_locked`.

## Why the replacement link also fails

`job_payment_requests` has a unique key on `(job_id, purpose, environment)`.
Creating a replacement intake link does not replace the job's failed payment.
The new link attempts to reserve an initial-fee payment, receives the existing
failed row with `claimed=false`, and raises `payment_details_locked` before
creating another draft or calling myPOS. There is no checkout URL to reuse.
The payment service also refuses to reclaim failed reservations automatically.

Relevant source:

- `supabase/migrations/20261020223002_add_mypos_payment_requests.sql`:
  unique reservation and `reserve_job_payment_request`.
- `supabase/migrations/20261023171927_support_typed_customer_locations.sql:130`:
  replacement-link reservation rejection.
- `src/features/payments/service.ts:18`: refusal to recreate an existing request
  without a provider code and URL.
- `src/features/payments/checkout-actions.ts:28`: customer error wording.
- `src/features/payments/payment-panel.tsx:11`: staff status label.

## Original provider rejection: limit of the evidence

`src/features/payments/mypos.ts:64` maps unsuccessful HTTP responses to safe
generic codes. `payment_provider_rejected` is the fallback for statuses not
separately mapped as authentication, permission, throttling or availability
errors. The integration retains neither the specific HTTP status nor the
provider's response body or request correlation ID. Therefore the exact reason
for the original myPOS rejection cannot be determined from the stored record.
It would be incorrect to claim a specific provider validation error, amount
limit, language problem or card decline from this evidence.

Another initial-fee request at **10:07:59** also has `creation_failed`,
`payment_provider_rejected`, **10,490 ISK**, and language `is`. The retained
successful initial-fee phone-audit request used **35 ISK** and `en`. These
differences are observations, not proof of which input caused rejection.

A current read-only merchant account check passed OAuth authentication, an
eligible ISK settlement account, and language support including `is` and `en`.
This verifies current read access and capability metadata, not successful
creation with the failed request's inputs. No successful payment is recorded
for the screenshot's attempt.

## Verification

- Hosted project reported `ACTIVE_HEALTHY`.
- Queried the affected payment, draft and intake-link metadata without exposing
  customer details, private tokens, merchant identifiers or credentials.
- Matched the 09:38 error log to the exact branch in the deployed function.
- `MYPOS_REST_CREDENTIAL_FILE=/home/freyr/.config/vegstod/mypos/rest-credentials.json npm run mypos:check`:
  **1 passed**, production creation disabled.
- Existing adapter, payment service, checkout service and checkout action tests:
  **108 passed across 4 files**. These confirm existing behaviors; they do not
  establish the original provider rejection reason or resolve the recovery gap.

## Required follow-up

Preserve sanitized provider diagnostics (HTTP status, safe error code and
request correlation ID) so a rejected creation can be diagnosed without
exposing secrets or customer data. Provide an audited recovery path for
confirmed failed creations, including replacement customer links, and truthful
localized messages when no checkout exists. Keep ambiguous creations protected
against duplicate requests. No recovery or live changes were performed during
this investigation.

## Follow-up: reproduced cause and implementation

The controlled production comparisons used fictional names, the real **10,490
ISK** amount, unique diagnostic references and no card data or SMS parameters.
They did not modify customer jobs, drafts or existing payments.

| Input difference | Language | HTTP result |
| --- | --- | --- |
| Same plain name | `is` / `en` | Both 200 |
| `Vegstod Diagnostic Client` (25 characters) | `is` | 200 |
| `Végstóð Díagnostic Client` (25 characters) | `is` | 400, provider code `4`, “Execution failed” |
| Same accented name with explicit UTF-8 charset | `is` | Same 400 |
| Same accented name using JSON Unicode escapes | `is` | Same 400 |
| Plain ASCII name of 26 characters | `is` | 200 |
| Short accented name `Végstóð` (7 characters) | `is` | Same 400 |
| Only `ó` added to the accepted plain name | `is` | Same 400 |
| Only `á` added to the accepted plain name | `is` | Same 400 |

Both affected drafts have accented customer names (letters include `í`, `ó`,
`ú`, and `á`). The experiments isolate the legacy provider's handling of the
customer-name field; changing the application language does not solve it. The
specific original provider bodies remain unavailable, but the matching failure
class is now reproducible. The length and JSON encoding alternatives were tested
and rejected as explanations.

The adapter now sends a Latin spelling of the name to myPOS, for example
`Þórður Ægir Guðjónsson` → `Thordur Aegir Gudjonsson`. The private draft and
operational job retain the original spelling. A separately gated check through
the actual updated TypeScript adapter accepted this Icelandic test name under
both `en` and `is`, and verified matching **10,490 ISK / Pending** provider reads.
Across all comparisons, twelve provider creation calls produced six unpaid links
and six explicit rejections. No checkout was paid and no message was sent.
Private probe/receipt ledgers remain outside Git under
`~/.config/vegstod/mypos/` with owner-only permissions.

Migration `20261026115922_recover_rejected_payment_creation.sql` adds sanitized
creation diagnostics and per-attempt history. An explicit retry can atomically
reclaim only an allowlisted definitive failure, with the same merchant, API and
amount and no provider code/URL. Each retry receives a new opaque reference;
the v2 finish RPC checks that reference before accepting a result. Pending,
Paid, unknown, timed-out, rate-limited and failed-persistence attempts cannot be
reclaimed. No migration operation initiates a provider request.

The customer payment summary offers retry of the exact saved draft, without
re-entering its details. A replacement active intake link can take over a
definitively failed draft. Existing checkout URLs and uncertain attempts stay
protected. Staff can retry a rejected service-payment preparation at its frozen
amount/description. Checkout errors now follow the form's selected language.

Verification completed during implementation:

- New name/diagnostic regression tests failed before the adapter fix and pass
  afterward for both languages.
- The complete disposable-database suite passed **576 application/integration
  tests**, with three credential/live sessions skipped, and **404 SQL assertions
  across 17 files**. Payment coverage: **90.86% of lines**.
- Concurrent retry tests confirm a single creation claim. SQL checks cover
  replacement links, preservation of the actual Icelandic name, legacy failure
  history, stale completion rejection and protection of uncertain/Paid requests.
- Production build and TypeScript passed. Lint warnings were corrected.
- The original working database's schema and migration history were verified
  unchanged after disposable integration checks.

## Hosted release

The fix is **live on https://vegstod.vercel.app**. Ready Vercel Preview deployment:
`dpl_2LXeT3SEcfstuoAX8Vckk6umgJeq`,
`vegstod-q8hdb4e0f-freyrs-projects-fad4047a.vercel.app`. The stable alias was
switched after the build succeeded and the hosted migration was verified.
The unused Vercel Production target and automatic Git-deployment setting were
not changed.

The release was assembled in `/tmp/vegstod-payment-release-20261026` from
`111ae22` plus the payment changes. Pre-existing uncommitted job-editor and
address-search changes were excluded and remain in the original working tree.
The initial activation did not commit or push source. Freyr subsequently
requested the Git checkpoint: the payment source, tests, migration and release
documentation are recorded on `chore/vercel-git-connection`, excluding the
pre-existing job/location edits. Git deployments remain disabled, so the source
push does not trigger another release.

Supabase assigned migration version **20261026115922**; the local migration
filename and runner/docs references were aligned to it. The SQL contents match
the tested recovery migration. Vercel's uploaded SQL artifact has its original
local generation timestamp; the SQL artifact is not executed by Vercel.

Before/after hosted verification retained **four jobs, six intake links, three
drafts, three staff profiles and four payment records**. Both prior Paid records
and both rejected requests retained their original statuses/references. Neither
an automatic retry nor a customer charge was initiated by deployment. The failed
requests now become eligible for recovery when the customer explicitly retries.

The new finish RPC exists, with execution denied to `anon` and `authenticated`.
Security advisories match the pre-release result: three intentional server-only
tables have RLS with no browser policy, and the existing
[leaked-password-protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
is unchanged. No new advisor finding was introduced by the migration.

The live login page loaded in a real browser with **zero console errors or
warnings**. Scheduled worker responses at 12:00 and 12:01 UTC were **HTTP 200**
with no timeout. The actual payment summary component was checked separately in
an isolated browser fixture at desktop/mobile widths, including Icelandic retry
copy, a token-only retry action, visible failure feedback, and no retry for
`creation_unknown`. Screenshots are in `output/playwright/payment-recovery-*.png`.
The fixture calls a simulated action; the provider acceptance checks above used
the real adapter/API and left their requests unpaid. Card-payment completion was
not repeated during this fix.

Final targeted service-panel checks passed **12 tests**, including rejected
service-payment retry. The disposable integration/SQL suite was rerun after the
last migration validation change: **24 integration/concurrency tests and 404 SQL
assertions passed**. Build, typecheck, lint and diff checks passed.
