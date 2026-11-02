# Owner follow-up release — 2 November 2026

## Authorization and scope

Freyr requested deployment of the four locally completed owner fixes and tests
after deployment. Release direct calling-code entry, SMS sharing, optional
vehicle destination and unpaid service-payment replacement together. Preserve
the pre-existing address-map/editor edits outside the release.

## Plan

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

Release and hosted acceptance are in progress. A myPOS checkout already opened
cannot be closed by IRA; the customer must close it and use the replacement.

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
and restores the existing live editor/map behavior. Hosted acceptance is pending.
