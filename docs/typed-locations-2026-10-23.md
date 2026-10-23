# Typed job locations and actionable form errors — 23 October 2026

Freyr approved the reviewed fix after a dispatcher entered `í Keflavík` and
received only “Farðu yfir innsláttinn.” Preserve the completed local phone work.

## Plan and boundaries

1. Share typed lookup/resolution between dispatcher and customer forms. Normalize
   common leading location phrases; resolve a clear place/address when the user
   leaves the field or submits. Ambiguous results require choosing a result.
2. Preserve GPS and map selection. Mark town-level coordinates as approximate,
   retain useful location descriptions, and prevent an older async result from
   replacing a newer typed location or map/GPS choice.
3. Show localized field errors, a linked summary and first-error focus. Validate
   before saving or starting checkout; keep entered data after a failure.
4. Add a rate-limited, active-customer-token lookup using the existing public
   location catalog. Keep its browser access restricted; no new public data
   policy or public service credential is introduced.
5. Extend the service-only customer submission/checkout validation to accept the
   existing `search` source. No tables, prices, payment status transitions or
   communication integrations change. Test the migration in a disposable clone.
6. Verify build, types, lint, regression/database assertions and mobile browser
   behavior; record outcomes and leave release/deployment explicit.

## Completed implementation

The customer and dispatcher forms use the shared location input. Typing
`í Keflavik` resolves the catalog's Keflavík result on blur or submission; an
explicit Find button remains available. An exact/unambiguous result supplies
coordinates without a map click. Multiple matches require a choice, and an
unknown place explains how to correct it or use GPS/the map. Place-level results
carry an approximate-location suffix and visible status; HMS street addresses
retain their precise label. Editing a location clears its old coordinates.

GPS, map selection, saved correction locations and existing descriptions remain
usable. Delayed lookup results cannot replace a newer location choice. The
provider editor also waits for the shared input's resolution before saving, so
it cannot submit blank coordinates while a typed lookup is pending.

Both job forms now show localized inline errors and a linked error summary,
focus the first invalid field and retain entered details. Missing assistance is
explained instead of silently disabling Save. Checkout validation returns field
errors before any payment request. Payment pricing, confirmation, correction,
billing, manual WhatsApp and driver workflows remain unchanged.

Customer lookup validates the existing active-link token and rate limit before
reading the catalog through a server-only action. Anonymous direct catalog
execution and direct customer writes remain blocked.

## Verification

- Final build, typecheck and lint pass. Full Vitest: **534 passed**, 24 skipped
  across 67 passing files and four opt-in skipped files. The earlier phone-only
  checkpoint was 501 passing tests.
- `npm run mypos:test:system`: **22 integration/concurrency tests** and **379
  pgTAP assertions** across 16 SQL files passed against a disposable clone.
  The original working database's schema, migration history and relevant
  function definitions were unchanged; disposable resources were removed.
- The 16 new SQL assertions check restricted access, catalog lookup, a searched
  correction/unpaid intake, searched checkout draft and trusted paid completion
  with no extra payment or operational/billing transition.
- Actual customer and dispatcher React forms were exercised in Chromium with
  isolated action/map/payment boundaries. Typed town submission, ambiguous
  choices, unknown-place rejection, error summary/focus, preserved values,
  approximate labels and E.164 phone payloads passed. No horizontal overflow at
  **320, 390 or 1280px**; no browser errors or warnings. These browser fixtures
  do not claim a new hosted or physical-phone end-to-end audit.
- Browser fixtures/evidence remain ignored under
  `output/typed-locations-20261023/` and `output/playwright/typed-location-*`.
  No real provider request, charge, message, hosted mutation or deployment was
  made. Existing live controlled-test spend remains 210 ISK.

## Release status

Implementation and documentation are local and uncommitted. Hosted data,
database functions and deployment are unchanged. Phone formatting requires no
database change; this separately approved location fix requires
[`20261023171927_support_typed_customer_locations.sql`](../supabase/migrations/20261023171927_support_typed_customer_locations.sql).
It adds service-role catalog access and permits the existing `search` source in
the service-only customer submission/checkout functions. It adds no tables,
columns, enums or payment transitions.

For an authorized release, inspect pending migration history, apply this function
update before publishing the new app, then use the manual Preview deployment
and stable-alias steps in the [deployment runbook](deployment.md). The tracked
`git.deploymentEnabled=false` guard is unchanged; a Git backup does not release
these features.
