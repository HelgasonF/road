# Phone and typed-location audit/release — 23 October 2026

Freyr authorized a complete audit, deployment and Git synchronization after the
local phone/location implementation. Preserve existing data, pricing, manual
WhatsApp and payment workflows. The public site uses the existing Vercel Preview
target, not the unused Production target.

## Audit findings and fixes

- Fixed a dispatcher save regression found during review: client-side schema
  validation transformed blank optional strings to `null`, then passed those
  outputs into the server action's input schema. The editor now validates
  locally and sends the original input shape; the server performs its existing
  normalization. A regression test failed before the fix and passes afterward.
- The earlier implementation review also fixed shared provider-location saving
  before lookup completion and distinguished an empty search from an outage.
- The first hosted browser pass found React hydration error #418 in the country
  picker. Browser and server `Intl.DisplayNames`/collation data differed (the
  browser also fell back from Icelandic country names). A shared static
  English/Icelandic country list now gives both renders identical names/order.
  A simulated cross-runtime hydration regression failed before the fix and
  passes afterward; a separate check covers every library-supported country.
- Reviewed phone formatting/normalization, no-default country behavior, untouched
  legacy phones, call/WhatsApp destinations, both form submission paths, stale
  lookups, error focus, customer token/rate checks and database privileges.
- Compared both pending function bodies to the actual hosted definitions. Only
  accepting the existing `search` source and its diagnostic text differ. The
  remaining migration statements grant service-role catalog access and preserve
  existing service-only write privileges. No table, enum, fee, payment state or
  communication sender change is included.

## Verified before release

- Final build, typecheck and lint passed; **536 application tests** passed, 24 opt-in
  tests skipped across 67 passing files and four skipped files.
- Earlier zero-cost disposable-clone verification passed **22 integration /
  concurrency tests and 379 SQL assertions**. The original working database was
  unchanged and disposable resources removed. The later audit fix touches only
  the dispatcher input shape and has its own regression test.
- Actual customer/dispatcher browser fixtures passed typed town, ambiguity,
  unknown-place rejection, field errors/focus, retained data, map selection and
  E.164 submissions at 320/390/1280px. No browser errors or warnings.
- Git remote was current before changes; automatic Git deployment remains
  disabled in `vercel.json`. Secrets and runtime artifacts stay ignored.
- Hosted migration dry run identified only
  `20261023171927_support_typed_customer_locations.sql`. Use `--linked` and
  `--skip-vault` for the release; no seed, role or Vault update is needed.
- Hosted baseline at 17:42 UTC: **two jobs, one active job, zero operators,
  three staff profiles, two payment requests, one frozen intake and one service
  page**. The catalog contains 139,346 addresses and 2,970 places. Reconciliation
  remains active. Preserve these records; the earlier empty-system note is a
  historical inventory, not the current state.
- Baseline security advisors show only the existing three intentional
  service-only RLS/no-policy informational findings and disabled Auth leaked
  password protection. No new warning is attributable to this release.

## Release progress

Initial source commit `c37e9eb` was pushed. The single migration is applied and
remote migration history is current. Catalog lookup works as `service_role`;
anonymous catalog/customer writes and authenticated draft preparation remain
blocked. Security advisors match the pre-release baseline.

The initial Preview `vegstod-khwjxchb6-freyrs-projects-fad4047a.vercel.app`
(`dpl_HdUy8sesfujtQG94ps7rJAPqQRq2`) is Ready and the alias was updated.
Its hosted staff/customer checks passed typed-place ambiguity, approximate town
labels, blank optional fields, E.164/display, localized errors/focus, preserved
data, 10,490 ISK pricing and widths 320/390/1280px. No checkout or message was
sent. That browser pass exposed the hydration issue above. The corrected source
`88f1e1c` was committed/pushed, rechecked and deployed manually.

**Completed release:** Ready deployment `dpl_BXLYy4f24SEWz8dSyHTohgN4jpjX`,
`https://vegstod-vr1npotdf-freyrs-projects-fad4047a.vercel.app`, created at
17:52 UTC. `https://vegstod.vercel.app` points to this corrected deployment.

- Repeated the actual hosted customer flow with browser error capture: active
  token-protected catalog lookup, same-name Keflavík choices, approximate labels,
  unknown-place rejection, name error/focus, retained description, saved country,
  bilingual labels and 320/390/1280px all pass. Icelandic country labels remain
  Icelandic even on a browser whose Intl locale data falls back. **Zero hydration
  errors; final browser console has zero errors and warnings.**
- Confirmed the corrected staff picker starts without a country and still sends
  E.164. The earlier real staff save also proved empty optional values persist
  as null and the searched coordinates/approximate label are correct.
- Revoked both owned customer links and verified the first revoked URL is
  unavailable. Deleted only the exact new unpaid audit job, guarded by its ID,
  name, phone, creation window, status, revoked links and absence of payments,
  assignments or photos. Final inventory matches baseline: **two jobs, one
  active, zero operators, three staff, two payment requests, one frozen intake
  and one service page**. No real customer work was modified.
- The active reconciliation schedule still succeeds; the checked worker response
  was HTTP 200. Pricing remains 10,490 ISK and WhatsApp remains manual. No paid
  checkout, real card transaction or message was created. No new physical-phone,
  driver-assignment or paid end-to-end audit is claimed.
- Source commits and final documentation are kept on
  `chore/vercel-git-connection`; the automatic Git deployment guard is unchanged.
  Updating release notes does not publish another app build.
- Documentation verification passed 29 Markdown files, 153 local links and
  balanced fences. `git diff --check` passes. Only release-note/documentation
  files changed after the final verified app source.

Previous deployment: `dpl_FwCDqd93y9rmEnRmgono7VQUqebB`,
`vegstod-gyj57bol4-freyrs-projects-fad4047a.vercel.app`.
Stable site: `https://vegstod.vercel.app`.

## Rollback

Point the stable alias back at the previous Ready deployment. The additive
function change remains compatible with GPS/map submissions and the prior app;
keep existing jobs and payment records intact. Git pushes remain source backups
because automatic deployment is disabled.

Private tokens, session state, credentials and screenshots belong only in
ignored evidence or private configuration, never in this record.
