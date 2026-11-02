# Optional vehicle destination — 2 November 2026

## Scope and result

Freyr selected owner report **3**, after issues 1 and 2 were completed locally.
He explicitly confirmed that the destination **must be optional**. Add a
plain-text destination, separate from the pickup coordinates, in both customer
languages and the dispatcher editor. A workshop, rental depot, address or town
can be entered without map selection. Blank/missing values remain valid.
Show a provided destination in dispatcher and assigned-provider details.
This is **committed, deployed and live-tested** as source `ca6f4b3`; the migration
is applied to hosted Road. The original local database remains unchanged. See
the [release record](owner-followup-release-2026-11-02.md).

Persist it as nullable `jobs.destination_label` (maximum 300 trimmed characters)
and in the existing frozen payment draft. Preserve the distinction between an
omitted field from an old client/draft and an explicitly blank new field, so old
saves/retries do not erase existing values or break frozen-draft equality.
Retain existing RPCs and add invoker-only destination-aware entry points that
reuse their guarded writes atomically. Extend paid finalization without changing
its expiry, verification, review or idempotency rules. Do not change payment
amounts, replace payment requests, alter sending workflows or implement issue 4.

The completed plan was:

1. Add regressions for optional/blank/missing values, bilingual input, display,
   staff/customer authorization, legacy writes and frozen payment submission.
2. Add the field through UI, validation, queries, server actions and a compatible
   migration. Reuse current staff/RLS and token/service-only boundaries.
3. Verify in an isolated database/browser fixture, plus build/types/lint and
   application tests. Preserve working/hosted data and unrelated map/editor work.

## Implementation

- Customer section 2 and the dispatcher full editor ask **Where should the
  vehicle be taken? (optional)** / **Hvert á að flytja ökutækið? (valfrjálst)**.
  Help suggests a workshop, rental depot, address or town and explicitly allows
  leaving it blank. There is no required attribute or destination geocoding.
  Switching language preserves the entered text.
- Input is trimmed, limited to 300 characters and stored as nullable
  `jobs.destination_label`. Empty/whitespace/null clears it. An omitted property
  from an old client or frozen draft is preserved as omitted, retaining an
  existing destination and exact frozen-payment retry equality.
- Destination is displayed separately from pickup in dispatcher details and the
  provider workspace. Existing pickup maps, navigation and coordinates retain
  their behavior. Empty destinations do not add an empty details card.
- Migration `20261102185452_add_vehicle_destination.sql` keeps old RPCs intact.
  `save_job_v2` and service-only `submit_customer_intake_v4` are invoker wrappers
  around existing guarded writers; destination updates occur atomically in the
  same transaction. The new staff writer also checks `is_staff()` explicitly.
  ACLs deny anonymous writes and direct authenticated customer submission.
- The existing frozen checkout JSON carries the destination with no provider
  API change. A constraint rejects non-text/overlong values and rolls back their
  reservation. Paid finalization differs from the existing function by one
  destination assignment only. Verification, locking, expiry after checkout,
  revoked-link review and once-only behavior are preserved. Later staff edits
  are not overwritten by repeated finalization.
- No first/second payment price, replacement/cancellation, messaging or
  assignment workflow was changed by issue 3. Issue 4 was subsequently completed
  locally; see the [replacement record](service-payment-replacement-2026-11-02.md).

## Verification

- Regressions were run before implementation; the missing destination behavior
  failed. Final targeted checks passed **74 tests in 8 files**. Final full
  application suite passed **639 tests in 76 files**; 28 opt-in cases across 5
  files were skipped in that run. The isolated run below exercises the database
  integration cases separately.
- `npm run mypos:test:system` passed **25 integration tests** with actual
  PostgreSQL/PostgREST and a local HTTP payment simulator, followed by **465 SQL
  assertions in 19 files**, including 34 destination assertions. This covers
  authenticated staff writes/clearing, denied driver/anonymous writes, legacy
  staff/customer writers, guarded one-time customer submission, nullable/old
  drafts, locked checkout details, verified Paid submission after expiry and
  idempotent completion. No merchant credentials or external payment API was
  used. The runner verified the original schema/history fingerprint was
  unchanged and removed its own clone/API container.
- `npm run build`, `npm run typecheck`, `npm run lint` and `git diff --check`
  passed. The inferred destination property is optional for older typed callers
  as well as runtime callers.
- Chromium checked the actual customer form, dispatcher editor and provider
  workspace at **320, 390 and 1280px** in an isolated Vite fixture. Empty EN
  checkout and filled IS checkout reached the mock action with unchanged pickup;
  language switching retained text; dispatch edit/clear and provider display
  worked. No horizontal overflow or final console errors/warnings. Backends,
  map rendering and photos were mocked; this is not a hosted end-to-end test.
  The fixture initially needed its missing `process.env` map setting; only the
  ignored fixture was adjusted, with no product map change.
- The unrelated address-search/map test files match their starting fingerprints.
  Earlier phone/SMS changes and the pre-existing editor/map edits are preserved.
  Evidence and local fixture files are ignored under
  `output/destination-20261102/`; no credentials or test resources are versioned.

## Release checkpoint — complete

Migration `20261102185452` was applied **before** deploying the source, since job
queries select its new column. The migration is additive; old source/RPCs keep
working and leave the optional column untouched. Keep this migration if rolling
back application source. Use the normal hosted release checks when a deployment
is requested. The initial implementation used only a disposable database; the
later approved release verified actual hosted persistence and customer prefill.
All four issues are deployed. No card was charged and no message was sent.
