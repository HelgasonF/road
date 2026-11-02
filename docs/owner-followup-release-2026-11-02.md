# Owner follow-up release — 2 November 2026

## Authorization and scope

Freyr requested deployment of the four locally completed owner fixes and tests
after deployment. Release direct calling-code entry, SMS sharing, optional
vehicle destination and unpaid service-payment replacement together. Preserve
the pre-existing address-map/editor edits outside the release.

## Completed plan

1. Build an isolated candidate from the current Git head plus only the approved
   changes. Verify build, types, lint, application tests and isolated database/
   HTTP-provider tests against that exact candidate.
2. Verify hosted schema/function versions, inventory and security-advisor
   baseline. Apply only `20261102185452` and `20261102192200`, preserving current
   business records, existing collection configuration and the scheduled worker.
3. Deploy to the existing Vercel Preview target, check the Ready candidate, then
   assign `vegstod.vercel.app` and test the stable site.
4. Use owned test fixtures for phone/code entry, same-message WhatsApp/SMS,
   bilingual optional destination and staff persistence. For the payment edit,
   create small **unpaid** service requests and check actual replacement/status
   reads without entering a card or sending a message. Retain any real provider
   request history on a cancelled audit job; revoke its IRA links afterward.
5. Record the release, verification limits and cleanup. Synchronize Git while
   preserving unrelated working edits and disabled automatic Git deployment.

## Before release

- Live alias currently serves source `2716c4b` on Ready Preview
  `vegstod-h6qg4fqqc-freyrs-projects-fad4047a.vercel.app`.
- Hosted Road `abpmzqtbllszqqetuubp` is healthy. Initial inventory: **7 jobs
  (3 active), 6 operators, 6 profiles, 2 assignments, 8 payment requests and 11
  intake links**. Both new migrations are pending; preceding migration history
  matches the repository.
- The existing security advisor reports four intentionally private RLS tables
  with no browser policy and the existing leaked-password-protection warning.
  Compare after migration; do not change unrelated authentication settings.
- Earlier local verification passed 669 application tests, 35 isolated
  integration tests and 499 SQL assertions, plus build/types/lint and responsive
  browser checks. Candidate counts may exclude the unrelated map test file.

Release and hosted acceptance are **complete**. The stable site is
**https://vegstod.vercel.app**, served by source `ca6f4b3` on Ready Preview
`vegstod-2vknn23ef-freyrs-projects-fad4047a.vercel.app`
(`dpl_CGMYghdgA12RY5H5GWVYVxiZL5Uv`). A myPOS checkout already opened cannot be
closed by IRA; the customer must close it and use the replacement.

## Candidate security patch

The isolated clean install identified existing production dependency advisories,
including Next.js critical RCE advisories
[GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw) and
[GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr), and
[Zod validation exhaustion](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
Before migration/deployment, update Next/ESLint config from 16.3.5 to **16.4.4**,
Zod to **4.6.6**, and compatible lockfile dependencies Sharp to **0.35.5** and
source-map-js to **1.2.2**. This is a compatible security patch, with no additional
product-flow change. Installed Next guides were read again. Production-only npm
audit now reports **zero findings**; development-tool audit notices are separate.

The patched, isolated release candidate passes **668 application tests** (75
files; 38 opt-in cases skipped), **35 database/API integration tests** and **499
SQL assertions**, plus build and lint. It excludes the single unrelated map test
and restores the existing live editor/map behavior. The original workspace also
passes typecheck and **669 tests**, including the preserved map test.

## Migration checkpoint

Source `ca6f4b3` contains the four fixes; `c0de23b` records the dependency patch.
Build/typecheck/lint pass on that candidate. The release credential scan found
no server environment secrets in tracked source or admin-credential introductions
in the release diff; existing synthetic seed/password-test values were retained.
Automatic Git deployment remains disabled.

The migration dry run listed only the two expected files. Both were applied
through the linked migration CLI with `--skip-vault`, without seeds or roles.
Hosted history matches timestamps `20261102185452` and `20261102192200`.
All five before/after fingerprints (jobs, operators, profiles, assignments and
payment rows, excluding new nullable columns and worker verification timestamps)
matched. The new columns/current-request index and browser-denied customer/
replacement RPC permissions were verified. The hosted security advisor matches
the original baseline, with no new findings. Vercel built Next 16.4.4 successfully;
the candidate passed HTTP/access and authenticated staff UI checks before alias
assignment. Anonymous root access uses a streamed redirect when HTTP is 200;
the test verifies the login redirect and absence of job HTML rather than assuming
every redirect has HTTP 307.

## Hosted acceptance

- Direct `+44` entry with no default country created an E.164 customer record and
  generated equal WhatsApp/SMS messages. The initial reserved dummy UK mobile
  number was correctly rejected before any job was created; a valid example
  number was then used, with no outbound communication.
- A separate anonymous customer context opened the actual private URL. English
  and Icelandic destination fields are optional, language switching preserves
  typed text, blank remains valid, the combined Pay and submit button remains,
  and the normal first fee is **10,490 ISK**. No first checkout was started.
- The actual dispatcher editor saved a typed Keflavík pickup and a distinct
  destination. A full page reload retained it, and the customer form read it
  back. Blank destination input remained valid. Both interfaces passed width
  checks at 320, 390 and 1280px.
- The owner account's actual API created an **unpaid 35 ISK service request**.
  Dispatch changed it to **40 ISK** with a revised description. The prior amount
  stayed in history as superseded; the new private URL and manual messages had
  the revised details. WhatsApp/SMS bodies matched. No first-fee row was created.
- An old IRA summary left open before replacement refused Pay after replacement;
  reloading it showed the unavailable page. The new 40 ISK summary exposed no
  direct provider anchor, and its server-checked Pay reached the actual myPOS
  checkout. No card field was filled or payment submitted; that context closed.
- Reissuing the current 40 ISK payment rotated only its IRA URL and kept exactly
  the same two service-request rows. No extra provider creation was needed.
- The minute worker remained active and returned HTTP 200 with **zero failed
  verifications**. The actual new request changed to provider status **2 / seen**
  after checkout opened, proving API-driven status updates without a return visit.
  The stable endpoint without its secret returned HTTP 401.
- There were no application JavaScript errors in the checked flows. Chromium
  logged four WebGL ReadPixels performance warnings during map capture. Harness
  selectors were adjusted for duplicate close controls, the custom assistance
  checkbox label and the deliberately collapsed message preview; no application
  workaround or additional deployment was needed.

## Cleanup and preserved data

The audit job is `845dc149-d936-4120-9d09-2dfd7f75b71b`, labelled **IRA release
audit 20261102** and marked not for dispatch. It was cancelled through the normal
staff UI. Its customer link was revoked and every service page expired; anonymous
browser checks confirm all owned IRA URLs are unavailable. The two actual unpaid
provider requests are retained as history. Their observed statuses remain pending
and seen; no provider cancellation or Paid result was forged. Only these test
rows have `next_check_at=infinity`, stopping further audit polling. All ordinary
customer requests retain their normal worker behavior.

Final inventory: **8 jobs (3 active), 6 operators, 6 profiles, 2 assignments,
10 payment requests and 12 intake links**. All five original business-row
fingerprints still match after excluding the owned fixture and new nullable
columns/worker timestamps. No original customer/provider/payment data was changed.
There were **zero card charges and zero messages sent**. The live Paid/card flow
was not repeated; its binding, late-Paid and race cases passed in the isolated
database/API suite, with prior real Paid acceptance preserved.

The owned browser session is signed out and closed, temporary authentication and
environment copies are removed, and the isolated worktree is removed after its
Git checkpoint. The protected original admin credential file remains unchanged.
Ignored verification evidence is under `output/owner-release-20261102/`. Release
code, migrations, tests and these notes are recorded in Git; automatic deployment
remains disabled. Pre-existing map/editor work stays in the original workspace.
