# myPOS payment testing — 21 October 2026

Release follow-up: Freyr subsequently authorized deployment to the existing
online site. The hosted configuration, migrations, authenticated minute worker
and no-charge browser checks are complete; see the
[hosted release record](mypos-hosted-release-2026-10-21.md). The chronological
evidence below retains the state at each earlier testing stage. The subsequent
[live phone audit](live-phone-audit-2026-10-21.md) added two successful 35 ISK
payments through the hosted database/worker, bringing total confirmed card test
spend to **210 ISK across six payments**. Normal pricing remains 10,490 ISK.

## Scope

Freyr requested completion of payment-system testing without spending real money. The production fee remains 10,490 ISK, with a separate dispatcher-entered ISK second payment. EUR is approved for isolated vendor sandbox protocol tests.

Freyr subsequently authorized using his own card as a fallback, then specified **35 ISK per payment**, with a maximum of **10 test attempts / 350 ISK total**. The prepared interactive session offers only two independent payment purposes, so completing both costs **70 ISK**. Freyr enters and confirms card details directly on myPOS; no card file is used. This is controlled-test authorization, not general customer release or authorization for a Gateway migration, automated refunds, new support messages or changes to existing operational/accounting behavior.

## Investigation and verification plan

1. Reproduce the existing EUR 1 legacy sandbox checkout rejection and identify whether it originates in the hosted payment page, account configuration or our request contract. Check vendor documentation for the exact test surface rather than assuming Web Checkout test cards work with Payment Requests.
2. Build a repeatable zero-cost integration test using the actual ISK adapter, checkout service, storage adapters and database RPCs against an isolated local database and a controlled HTTP payment simulator. Verify the 10,490 ISK first fee, manual second fee, no-return completion, duplicate protection and interrupted/failing requests.
3. Exercise the real browser flow where practical and run the existing database, build, type, lint and regression checks. Retain evidence and remove only disposable test resources.
4. Clearly distinguish verified application behavior from vendor sandbox card acceptance and production merchant acceptance. A locally simulated Paid response does not prove myPOS processed a sandbox payment.

## Starting evidence

- Owner production credentials authenticated and returned eligible ISK settlement details in earlier read-only checks. Production Payment Request creation remains untested.
- The public legacy sandbox created and returned the existing EUR 1 request and exact hosted URL. The browser shows that amount correctly.
- Five published Web Checkout test cards were rejected by that hosted page; the legacy details API subsequently returned numeric 2 (Seen). No successful vendor Paid result has been observed.
- Existing local verification passed 424 application tests and 363 database assertions. The new payment migrations remain absent from the working and hosted databases.

## Results

### Vendor sandbox

- Reproduced the rejection directly on the existing EUR 1 myPOS-hosted checkout, independently of the application.
- The hosted `POST /pr/en/checkPan` returned HTTP 200 with `{"status":false,"is3dsV2":false}` for a published test card; submission displayed the unsupported-card error. The published five online test cards all failed. The additional `4111…1111` example from myPOS's own PHP SDK documentation also failed. No real card was used.
- The **21:04 UTC** legacy details GET still returned matching code, EUR 1 and numeric **2 (Seen)**. The API never reported Paid. The exact vendor-side account/card-acceptance cause is not established; changing the application's status mapping would not resolve this hosted checkout rejection.
- [Web Checkout sandbox guidance](https://developers.mypos.com/online-payments/initial-setup-and-testing/testing-in-sandbox/test-data) describes a separate `/vmp/checkout-test` integration. [PayLink testing guidance](https://developers.mypos.com/online-payments/payment-links-buttons/testing) instead describes a free page-load check and a small real-card test. Neither establishes working test-card acceptance for this exact legacy Payment Request account.
- Inspected the dedicated demo merchant signup as an alternative. No account was created, no signup submitted, no marketing consent selected and no verification message requested. The unused prepared credentials were removed after closing that browser.
- A read-only search of the existing myPOS email thread found only an acknowledgement for ticket **4436744**, not developer instructions. No new email or support message was sent.

### Application and database

Added `npm run mypos:test:system` and `npm run mypos:test:system -- --full`. The runner clones **schema only** from the running local Supabase stack into a unique `road_mypos_test_system_*` database. It seeds synthetic local fixtures, runs a separate localhost PostgREST container with its own test JWTs, and connects the actual payment adapter, checkout service and storage adapters to a local HTTP simulator. Owner credentials and production payment flags are explicitly cleared for this test process. No simulator is added to deployed application code.

The **20 new integration tests** exercise fixed 10,490 ISK collection; complete frozen-form persistence; matching Paid verification and submission by a fresh worker without a customer browser; a separate 27,000 ISK fixture service payment; unchanged operational and invoice states; simultaneous clicks/workers; pending/seen/failed/expired/cancelled/unknown responses; wrong amount/currency/reference; permission failure and ambiguous creation without retries; recovery after an outage or worker interruption; expiry/revocation; immutable second-payment amount/description and rotated page hashes; invalid intake tokens; and anonymous API access rejection. The existing two real PostgreSQL concurrency tests also run.

Added automatic dispatcher status display: while known requests are awaiting verification, the visible job panel reads verified database state every 15 seconds. Hidden tabs pause reads; returning to the tab refreshes immediately; reads never overlap and stop when no request needs monitoring. Failures retain the known state and retry with a visible notice. These reads never create payments or call myPOS. The authenticated worker remains responsible for checking the provider about once per minute after scheduler activation. Six new component tests cover the automatic display and its failure/lifecycle behavior.

Final verification:

- **450 tests passed** across **60 passing files**. The latest run intentionally skipped two opt-in cases: the owner-account check and the separate interactive real-card session. Neither belongs in the zero-cost automated run.
- **363 pgTAP assertions in 15 files** passed in the disposable clone.
- Payment-source coverage: **88.86% lines / 76.19% branches**. The adapter and checkout orchestration each reached 100% line coverage in this run; that does not prove vendor acceptance.
- Build, typecheck, lint and `git diff --check` passed.
- Real-browser fixture verification at 390 × 844 showed pending → Paid automatically, no repeated charge controls after payment, and no horizontal overflow. Server responses in this UI fixture are simulated. Screenshots: `output/playwright/payment-status-pending-mobile.png` and `payment-status-paid-mobile.png`.
- The automated runner verified that the working database's payment tables and migration history were unchanged, then removed its database and REST container. The working/hosted payment migrations, scheduler and live flags remain unapplied/disabled. This automated run made no real card payment or production API write. The subsequently authorized, separate card session is recorded below.

### Completed controlled card session

`npm run mypos:test:card` reuses the schema-only isolation setup and runs only `scripts/mypos-card-session.test.mjs`. The explicit interactive mode loads the existing protected production credential file, starts a private localhost control page, and uses the real adapter, checkout service and database RPCs. Its synthetic form fixture supplies Freyr's name and test incident details; this does not replace deployment/browser acceptance of the normal customer form. The normal `.env.local` fee remains 10,490 ISK and its collection/live flags are unchanged.

The **35 ISK initial-fee payment succeeded**. After Freyr completed checkout directly on myPOS, the background worker verified the matching real request as Paid at **21:16:04 UTC** and automatically submitted the saved customer draft. This used the actual merchant REST adapter and database finalization without a customer return action. The first request was reused throughout; no replacement initial payment was created.

At **21:18:06 UTC**, the separate **35 ISK service request** was prepared after the first payment and intake were confirmed. The worker first observed Seen, then verified **numeric 4 (Paid) at 21:20:04 UTC**. Both independent requests match their own code/reference, **35 ISK** and **ISK**. Total confirmed payments: **70 ISK across two requests**. No replacement initial payment, additional checkout or refund was made. The job remained `new`, with no driver assignment; internal billing remained `receivable_status=missing_information` and `payable_status=not_ready`.

The control page offers no card fields, does not read POST bodies, accepts only its fixed purpose actions and never takes an amount from the browser. It preserves ambiguous attempts rather than retrying creation. Its only available payment purposes cap this session at two possible successful payments (70 ISK), within the 10-attempt/350-ISK authorization. Card checkout attempts themselves are performed and confirmed by Freyr on myPOS. The worker checks about once per minute independently of the browser.

The local test-page failure was reproduced: its `Referrer-Policy: no-referrer` causes a native browser form POST to send `Origin: null`, which the original exact-Origin assertion rejected with HTTP 409. A real Chromium form probe reproduced that header and rejection. The saved harness now authenticates each fixed action with a separate random session token, accepts missing/null Origin only with that token, rejects foreign Origin/Host/path/token, and prevents finishing until both exact payments and intake submission are confirmed. All **15 focused regression tests** pass; the same browser probe passes the new guard. The focused controller and dispatcher-display run passes **24 tests**, with the live-card case skipped in that ordinary run. Lint, typecheck and diff checks pass. The existing running session was retained, and its second request was prepared through the authorized local controller with the expected Origin; no new session or duplicate payment was created. The source fix takes effect on the next harness run.

After both Paid results and automatic intake submission were confirmed, the existing session was finished successfully. The interactive acceptance test passed, followed by **all 363 pgTAP assertions in 15 files**. The runner verified that the working schema/history remained unchanged and removed its own controller, REST container and isolated database. No hosted database or general customer deployment is enabled. The outside-repository ledger is `/home/freyr/.config/vegstod/mypos/card-test-81aa5d10-175c-4480-b1e3-5c4fb73ab913.json` (0600); it contains request references, amount, status and confirmation/submission evidence, never card data or merchant secrets. The private control URL was shared directly with Freyr and is now closed; it is not stored in repository documentation.

### Remaining acceptance work

The free application/database checks and the controlled real-merchant acceptance of both payment purposes are complete. **Two 35 ISK payments / 70 ISK total** were sufficient. Successful vendor sandbox card processing remains unverified, but does not invalidate the directly verified real-merchant results. Retain the private ledger; no further card tests are needed for this acceptance case.

The real-card session verified actual API Paid results, the two independent amounts, saved-form finalization without a return action and unchanged operational/accounting state. The normal customer-form and dispatcher display checks are recorded separately above; the card fixture is not a hosted UI deployment. General release still needs deployed configuration, authorized payment migrations and the unattended scheduler.

The acceptance-gap review identified that full application acceptance was still required before launch; the connected phone run below has now completed that journey. The successful card fixture supplied the customer draft and started each request directly through the checkout service. It did not exercise one continuous journey through the normal authenticated dispatcher screen, generated customer URL, mobile customer form, Pay and submit redirect, unattended worker endpoint, automatic staff status display, dispatcher-entered second amount, private service summary page and second Paid display. The connected run exercised those screens together and checked safe link reissue; automated failure/retry/concurrency cases remain separately recorded above. Existing service/component/database checks cover many of these behaviors separately; they do not replace that connected browser run.

If a final real-card run is used for that complete application journey, retain **35 ISK per payment**, count both requests against the existing shared **10-attempt / 350-ISK** authorization, and have Freyr complete checkout directly on myPOS. That additional pair has now completed, bringing confirmed payments from **70 ISK to 140 ISK**. Do not recreate the completed fixture requests or reset the overall budget. No additional payment was created during the gap review itself; the subsequent authorized phone run is recorded below.

### Full application phone test setup

Freyr authorized using his USB-connected phone or the computer for the normal WhatsApp/customer journey. A Samsung SM-G990B2 is authorized through ADB and has WhatsApp and Chrome installed. The intended recipient is Freyr's own +354 659 7003 test/self chat; no unrelated contact or automatic Cloud API sending is authorized by this test.

A separate local Supabase project `RoadPayPhone20261021` was started with its own Auth, REST, Storage and database. All repository migrations and synthetic seed data were applied only there. Its temporary database has a 35-ISK-only constraint and a trigger limiting payment requests to two purposes for one job and the approved phone number. The normal app ran on localhost port 3100 with the test fee set only in its process environment. ADB reverses ports 3100 and 55321 to the phone. The normal `.env.local` price remains 10,490 ISK; the working Road stack and hosted deployment remain unchanged.

The prior two payments remain complete at 70 ISK. This new connected-screen test can add at most 70 ISK, for 140 ISK across four requests within the existing shared 10-attempt/350-ISK approval. Card entry and payment confirmation remain Freyr's actions on myPOS. No payment request had been created at the initial handoff to Freyr.

The connected-flow review reproduced an application gap with two failing component tests: an already-open dispatcher panel did not discover a first checkout created later on the customer's phone, and retained its original payment snapshot when completed intake arrived. The panel now watches pending intake before a request exists and refreshes its state when `intakePending` changes. All 11 panel tests and all **180 relevant payment/customer-form tests** pass; build, typecheck, lint and diff checks pass for that change.

The normal dispatcher UI created the phone-only job, generated its private customer link and produced the expected WhatsApp text. The exact generated draft was sent from native WhatsApp to the verified `+354 659 7003 (You)` self-chat. WhatsApp displayed the loopback-IP URL as plain text, and Freyr reported that it could not be tapped. This is a test-address limitation. Two temporary HTTPS Quick Tunnels exposed only the separate test app and its separate API for the completed run. The temporary dispatcher password was randomized before continuing publicly; signup remains disabled. `ROAD_DEV_ORIGIN` allows the exact test host for Next dev assets/Server Actions only in development, and is ignored in production. The same job was retained, the customer link was rotated through the normal UI, and its new HTTPS draft was sent to the same self-chat. Freyr was asked to fill the form, pay 35 ISK and close checkout without returning while dispatch is observed.

The phone briefly relocked during setup. Its prior `stay_on_while_plugged_in` setting was saved privately and temporarily set to USB so the display stays awake. Restore that exact value after the phone test. Never inspect or capture the myPOS card-entry screen. The isolated app worker calls the actual authenticated reconciliation route about once per minute; an unauthenticated probe returned HTTP 401, and the worker returned HTTP 200.

### Phone form findings during acceptance

Freyr initially read the link's time as an expiry that had already passed, then confirmed that its displayed date was tomorrow. The database confirmed expiry **22 October 2026 at 21:37 UTC**, no revocation and no submission; expiry was not the cause of the inactive submit attempt.

The actual Firefox phone form had a confirmed GPS location and selected assistance, but an empty required Description. Native validation prevented any checkout action and gave no useful visible explanation at the bottom. Added form-level invalid-field feedback in the chosen language, with focus/scroll to the first invalid control. Two new regression tests reproduce missing-description and first-missing-field behavior. The initial CSS `:invalid` selector caused recursive validation in jsdom; the implementation now reads each control's `validity.valid` without firing additional validation events. All **10 customer-form tests** and typecheck pass after that correction.

After Freyr completed the description, the normal phone form created one **35 ISK initial request** and saved its private frozen draft. The already-open dispatcher screen discovered the pending payment automatically, without navigation or refresh. Database checks confirmed a provider-attached request, actual numeric **1 (Pending)**, saved/unfinalized draft, `intake_pending=true` and operational job `new`. Freyr is completing myPOS checkout directly; no card-entry screen is inspected or captured.

### Connected payment results — complete

The first real phone-form payment was verified as **numeric 4 (Paid) at 21:45:21 UTC**. The frozen draft finalized automatically and the operational job remained `new`. The continuously open dispatcher page, without navigation or manual refresh, changed from no request to Pending, Seen and Paid, displayed the submitted customer name and details, and enabled the separate service-payment controls. The form supplied GPS, vehicle brand/registration, people count, assistance type and notes through the normal validated action. No optional photo was selected in this connected run. The existing independent upload checks remain separate evidence. Screenshot: `output/playwright/mypos-phone-initial-paid-dispatch.png`.

Through the normal authenticated dispatcher inputs, entered **35 ISK** and an electric-vehicle assistance test description, then prepared the separate service request. Amount and description became locked in the UI. Exercised **Nýr tengill fyrir sömu greiðslu** once before sending: the application page token changed, the old page showed unavailable, the fresh page showed the correct service/vehicle/35 ISK, and both provider request IDs, references, codes and amounts remained identical. Exactly two requests exist in the phone-test database. The fresh service draft was sent from native WhatsApp to the same verified self-chat. Freyr completed checkout, and the actual authenticated worker verified **numeric 4 (Paid) at 21:49:21 UTC**. The continuously open dispatcher page automatically showed both payments as Greitt, removed the second-payment form and verification controls, and displayed the confirmed-service notice. The public service page now shows Payment received and removes its checkout link. Exactly two requests remain associated with this job; the job is still `new`, no driver is assigned, and internal billing remains `missing_information` / `not_ready`. Screenshot: `output/playwright/mypos-phone-both-paid-dispatch.png`.

After the validation and discovery fixes, a complete zero-cost regression run passed **469 tests in 61 files** (two opt-in cases skipped), **363 pgTAP assertions in 15 files**, build, typecheck, lint and diff checks. Payment-source coverage in that run is **88.83% lines / 76.09% branches**, including the panel in the reported files. The automated runner cleaned its own schema clone/REST container and confirmed the working Road schema/history was unchanged. The connected phone test is complete. Confirmed overall card spend is **140 ISK across four successful 35 ISK payments**: the earlier API fixture pair plus this connected-screen pair. No refund or further request was made. Final evidence is retained outside Git in `~/.config/vegstod/mypos/phone-flow-acceptance-20261021.json`. Cleanup was verified: the temporary app/worker and both HTTPS tunnels stopped; the dedicated Supabase containers and volumes were removed; ports 3100/55321/9230 were closed; the exact original phone display setting was restored; only this test's USB forwards were removed; the phone browser was detached without closing personal tabs; and the temporary staff password file was deleted. The owner merchant credential file was retained. The working Road payment tables/migration history remain unchanged, the normal first fee remains **10,490 ISK**, and normal live collection remains disabled. No deployment, hosted migration, production scheduler activation or refund occurred.

### Prepared support follow-up — not sent

Reply from **hello@cevlin.com**, if a follow-up is explicitly requested, referencing ticket 4436744:

> We are testing the existing Transactions REST API v1.1 Payment Request flow using the documented public sandbox credentials. OAuth, settlement data, EUR request creation and the details endpoint work. The returned demo.mypos.eu/pr URL displays the correct amount, but all five published online test cards are rejected as unsupported. The checkout's checkPan endpoint returns status=false and is3dsV2=false; request details remain numeric 2 (Seen). Which test-card data or sandbox merchant configuration supports a successful legacy Payment Request payment and numeric 4 (Paid)? If a dedicated demo merchant is required, please provide the onboarding steps. Our production merchant uses ISK; these EUR tests use only the sandbox. No production credentials or real card data are included.
