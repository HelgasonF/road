# Service payment replacement — 2 November 2026

## Scope and result

Freyr selected owner issue **4** after issues 1–3 were completed locally.
Allow dispatch to change the unpaid second payment's amount/description and
prepare a new private link inside IRA. Preserve the first fee, existing payment
history and manual WhatsApp/SMS sending. Initial implementation stayed local;
Freyr then approved deployment and hosted testing. All four fixes are now
**committed, deployed and live-tested** as source `ca6f4b3`, with both migrations
applied to hosted Road. The original local database remains unchanged. See the
[release record](owner-followup-release-2026-11-02.md).

The completed plan was:

1. Add regressions for replacement, Paid/uncertain guards, concurrent/repeated
   requests, stale links, late payment and unchanged initial-fee behavior.
2. Keep old requests as superseded history, one current request per purpose,
   and service-only transactional replacement with an expected payment ID.
3. Recheck all potentially payable service requests before replacement or
   opening checkout. Invalidate the old IRA page, keep polling superseded
   requests, and stop collection if any service payment is verified Paid.
4. Add dispatcher editing and revised sharing, plus server-checked customer Pay
   so a page rendered by the new source cannot directly open a replaced checkout.
5. Verify using a disposable database and HTTP provider simulator, application
   tests, build/types/lint and responsive browser checks. Preserve prior work.

## Provider boundary

IRA can invalidate its own private link. It cannot close a myPOS checkout that
the customer already opened. The official
[endpoint mapping](https://developers.mypos.com/guides/api-migration-guide)
lists edit/delete for Payment Links, but only create/list/details/reminder for
the Payment Requests used here. No provider-cancellation claim is made.
Dispatch must tell a customer with an open old checkout to close it and use the
replacement. Retain and verify the old request so a late Paid observation is
visible and stops new collection; never relabel a superseded request as a
provider-confirmed cancellation. A provider-hosted checkout already opened
cannot be fenced atomically by a local database transaction.

## Dispatcher and customer behavior

- For an unpaid service request, choose **Breyta upphæð eða lýsingu**. Edit
  the amount/description, then choose **Skipta út og búa til nýjan tengil**.
  **Hætta við breytingu** discards the edit without changing a request or URL.
- Replacement prepares a fresh private IRA link and revised manual message.
  WhatsApp and SMS share the same complete message, amount and URL. The message
  explains that it replaces the previous service link and asks the customer to
  close any earlier checkout. Staff still press Send themselves.
- The previous request remains in payment history with its original amount,
  reference, provider code and observed status, marked **Skipt út**. Its private
  IRA page expires; the new request becomes the sole current service request.
  **Nýr tengill fyrir sömu greiðslu** still reissues the current request using
  its existing amount and description, with no new provider creation.
- Paid and unresolved creations cannot be replaced. Existing definite-failure
  recovery remains available. A stale edit is fenced by the expected payment ID.
  Any verified service Paid stops collection; a superseded Paid or multiple
  Paid requests produces an explicit staff review alert. Prepared messages are
  hidden after Paid or when their request is no longer current.
- New service pages expose a checkout-available flag rather than the raw
  provider URL. **Pay** submits only the private token, checks its active page
  and job, verifies service history, and rechecks the token before returning a
  validated provider URL. Old HTML already loaded before deployment may still
  contain the old direct URL; it shares the provider limitation described above.
  The first-payment form and combined Pay and submit behavior are unchanged.

## Persistence and authorization

Migration `20261102192200_replace_service_payment_links.sql` adds nullable
`superseded_at` and unique `replaces_payment_id`. A partial unique index allows
history while enforcing one current request per job/purpose/environment. A
constraint prevents superseding or replacing the first fee. Existing rows
remain current and require no backfill.

Service-only, invoker `replace_service_payment_page` validates staff, job,
account, amount/description, expected predecessor and a recent verified unpaid
observation (or a definitively rejected creation with no remote request).
Superseding, expiring the old IRA page, reserving the successor and saving its
summary occur in one transaction. An invalid token or other persistence error
rolls the transaction back. Repeated identical calls reuse the unique successor;
different stale replacements fail. Creating/uncertain requests never authorize
a second creation POST. Definite-failure retry keeps the successor ID and uses
the existing reference/history fencing.

Service reservations, replacement and status observations take the job lock
before the payment lock. Any Paid observation blocks later reservations and
expires other unpaid IRA pages. The worker's existing queue still includes
superseded pending/seen/failed/unknown requests, allowing late Paid to be seen.
The original first-fee reservation/recovery and Paid-finalization behavior remain.
No new scheduler, provider operation, sender integration or invoice-ledger
transition was introduced. Reads can continue with production creation disabled.

All mutations remain behind verified staff actions plus existing job RLS and
server-only RPC grants. Customer Pay uses a valid hashed bearer page and the
existing request limiter. SQL cannot be called directly by browser roles. Only
explicit safe diagnostic codes reach the UI; credentials and raw tokens are not
stored in source or database payment pages.

## Verification and cleanup

- Test-first checks reproduced the missing edit/replacement/late-Paid behavior
  (5 failing assertions before implementation). Final targeted checks passed
  **134 tests in 8 files**.
- Full application suite: **669 tests passed in 76 files**; 38 opt-in cases in
  5 files skipped in that run. Build, typecheck, lint and `git diff --check` pass.
- Disposable PostgreSQL/PostgREST and local HTTP provider simulator:
  **35 integration tests** passed, plus **499 SQL assertions in 20 files**
  (34 new replacement assertions). Coverage includes actual private-page query
  resolution, no raw URL in public summaries, expiry/superseded checks, Paid
  proof matching, concurrent replacement clicks, both serialization orders of
  Paid versus replacement, stale edits, rollback, first-fee preservation,
  definite failure/retry and uncertain creation without a repeat POST.
- Chromium at **320/390/1280px** checked real components for edit/cancel,
  replacement message and same WhatsApp/SMS body, retained old amount/status,
  unchanged first fee, late-Paid removal of the sharing controls, and token-only
  customer Pay with EN/IS errors. No horizontal overflow or final console
  errors/warnings. The isolated UI fixture mocks backends; the database/API
  behavior is verified separately above. Native phone/carrier delivery and real
  card payments were not repeated.
- The browser script initially selected the description by label and waited
  for the deliberately collapsed message textarea to be visible. Switching to
  its accessible textbox role and waiting for attachment corrected the test
  harness; no product workaround was needed.
- Earlier map/editor/phone/SMS/destination files match their starting
  fingerprints where untouched. Test evidence is ignored under
  `output/service-replacement-20261102/`. The integration runner verified its
  original database/schema history fingerprint and removed its owned clone/API
  container. The owned browser and Vite server are closed after verification.
  No hosted write, outgoing message or card charge occurred.

## Release checkpoint — complete

Issues 1–4 are committed and deployed. Destination migration `20261102185452`
and replacement migration `20261102192200` were applied before source `ca6f4b3`.
The hosted test created an unpaid 35 ISK request, replaced it with 40 ISK, blocked
the old IRA page, opened the real provider checkout without entering a card,
and safely reissued the same current payment. Both requests remain unpaid on a
cancelled audit job; all IRA links are disabled and test polling stopped.
Normal first pricing stays 10,490 ISK. Superseded history is retained; do not
restore the old uniqueness constraint or remove history. Once replacements exist,
a rollback must use a UI that selects the current request; pre-replacement UI
would select its oldest row. Git deployment remains disabled.
