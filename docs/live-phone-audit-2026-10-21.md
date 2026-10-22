# Live site phone audit — 21 October 2026

**Completed:** customer/payment and private-photo checks passed. Both real 35 ISK
payments were confirmed by the hosted worker; overall test spend is 210 ISK
across six payments. Cleanup is complete, with the cancelled audit job and its
two Paid records retained. The public site keeps its normal 10,490 ISK fee.
Driver assignment and progression were not repeated. The plan and progress
below preserve the sequence of the audit; the final result is recorded at the end.

Freyr requested a physical-phone audit after the myPOS release to
`https://vegstod.vercel.app`. Use the connected Samsung SM-G990B2 and only
Freyr's own WhatsApp self-chat. This is the actual hosted site and database;
normal first-payment pricing remains **10,490 ISK**.

## Plan and boundaries

1. Create an identifiable phone-only test job through the normal staff UI.
2. Deliver its generated message through native WhatsApp to the verified
   `+3546597003 (You)` self-chat and open the actual stable HTTPS customer link.
3. Check phone layout, both languages, expiry, GPS/map confirmation, required
   fields, photo upload/removal and payment price/explanation.
4. Check dispatcher visibility, payment state and scheduled worker health.
5. For payment acceptance, use a temporary hosted deployment with a
   deployment-only `MYPOS_INITIAL_FEE_ISK=35` override. It uses the actual hosted
   database and the main site's existing Cron worker. Do not change the stable
   site's 10,490 ISK fee or project-wide environment. Prior test approval was
   **35 ISK each**, maximum 350 ISK overall, with 140 ISK already spent; the
   two purposes can add at most 70 ISK. Freyr enters/confirms his card directly
   on myPOS. Pause at the reviewable form before opening checkout.
6. Check the driver workflow too if Freyr selects that scope. Keep audit records
   separate, and remove only owned temporary records/files after completion.

Do not capture, store or enter card details. Do not send to unrelated contacts.
Preserve the original phone display setting and existing browser tabs. No
automatic refund, global price reduction or WhatsApp API switch is planned.

## Initial state

- Phone is connected and unlocked; original display setting is `3`.
- Hosted database has zero jobs/operators/payment requests and three profiles.
- Public alias points to the payment-enabled deployment recorded in the
  [release audit](mypos-hosted-release-2026-10-21.md).
- Customer-flow checks are starting; additional workflow scope is pending.

## Progress

- Created the phone-only audit job through the normal hosted dispatcher.
- Native WhatsApp recipient was verified as `+354 659 7003 (You)` and the entry
  matched the generated message exactly before sending. The message is Read.
- Tapping the actual stable HTTPS link opened the customer form in the phone's
  default Firefox. English and Icelandic showed the correct next-day expiry.
- Created a clearly marked synthetic test photo on the phone; no personal
  photo was selected.
- Temporary 35 ISK deployment built successfully:
  `https://vegstod-43973ghnu-freyrs-projects-fad4047a.vercel.app`
  (`dpl_ELtsmDv5aE9d7Hzi9s7GacXZbs2a`). The main public alias is unchanged.
  Remove this temporary deployment after the audit; keep actual payment evidence.
- The physical phone showed the main site's normal **10,490 ISK** fee and
  explanation; screenshot `output/mypos-live-phone-20261021/main-site-price.png`.
- A clearly labelled controlled-audit message used the temporary 35 ISK origin.
  Its native WhatsApp self-chat and exact draft were verified before sending.
  The phone opened the audit form, and Freyr completed its details and GPS.
- The hosted first request was created at **22:18:18 UTC** for **35 ISK**. The
  private draft contains the name, expected phone, GPS source and description.
  No photo was attached before this checkout. Intake remains pending until the
  actual scheduled worker confirms Paid. Phone inspection is stopped while
  Freyr completes the myPOS card page; no card data is captured or entered.
- At **22:19:00 UTC**, the actual hosted Cron call returned HTTP 200 with one
  verified request, zero failures and zero submissions. The API returned numeric
  **2 (Seen)**. The draft correctly remained unsubmitted. The continuously open
  dispatcher panel displayed the 35 ISK first payment and automatic-status text.
- At **22:20:01 UTC**, the hosted worker verified numeric **4 (Paid)** for the
  first 35 ISK request. It finalized the frozen draft at **22:20:02 UTC**; the
  scheduled response was `{verified:1, submitted:1, failed:0, reviewRequired:0}`.
  The untouched dispatcher browser updated to the submitted customer/GPS/
  vehicle details, showed **35 ISK · Greitt**, and enabled the separate second
  payment controls. This used the main site's actual hosted worker, not a local
  fixture or a staff verification click. Confirmed overall test spend is 175 ISK.
- Entered **35** and a clearly marked towing audit description in the normal
  dispatcher second-payment controls. The hosted summary displayed that exact
  service, registration and 35 ISK. Amount/description became disabled after
  reservation. Freyr is operating the customer/card flow on the phone.
- Exercised **Nýr tengill fyrir sömu greiðslu** before sending. The old summary
  became unavailable and the new token differed. The request count stayed at
  two, with the same fingerprint of request IDs/references/provider codes/
  purposes/amounts (`51c3a3172ee87d4b18c0cb4f3de0611a`). No duplicate request.
- Opened native WhatsApp before inspecting the phone, verified the self-chat
  and exact generated current service message, then sent it. The second link
  uses the actual stable `vegstod.vercel.app` summary. No card-page inspection
  occurred; the phone remains under Freyr's control for the second payment.
- At **22:24:01 UTC**, the hosted worker verified numeric **4 (Paid)** for the
  second 35 ISK request. Its response reported one verified request, zero
  failures and zero submissions. The untouched dispatcher displayed both
  **35 ISK · Greitt** rows and removed the second-payment inputs. Reloading the
  public summary displayed **Payment received** and removed its checkout link.
- Overall confirmed spend is now **210 ISK across six successful 35 ISK
  payments**, within the original ten-attempt/350-ISK budget. This hosted audit
  added only 70 ISK. No further payment is planned.
- Removed only temporary deployment `dpl_ELtsmDv5aE9d7Hzi9s7GacXZbs2a` after
  both payments completed. The main site and project-wide 10,490 ISK setting
  were preserved; hosted Paid records remain intact.
- Verified the exact saved name, phone and description match the submitted
  job. Operational status remained `new`, assignments zero and internal billing
  `missing_information` / `not_ready`. Provider collection did not advance or
  settle those separate ledgers.
- Created a normal correction link on the main site. Its completed browser
  render has **Send details securely**, no **Pay and submit** and no new first
  fee. The native self-chat and exact correction message were verified before
  sending. Firefox's per-site GPS permission prompt on the normal domain was
  accepted; photo-picker verification is in progress.
- Native Firefox opened its Camera/Files chooser and then Android Photo Picker.
  The synthetic 800×600 PNG (7,271 bytes) uploaded successfully at **22:29:29
  UTC**; Android exposed the selected file as `1000021659.png`. Its completed
  database row and private Storage object both existed. The authenticated staff
  page rendered the image with natural dimensions 800×600 after a refresh.
- The photo bucket remains private. A clean browser requesting the real photo
  ID with a wrong customer token received HTTP **404**. The expected 404 network
  error is the access-rejection test, not an application rendering failure.
- Freyr asked why this form says Send details and whether the first form already
  supplied the details. Confirmed that the initial form/payment already submitted
  all details, and this correction link is only an audit step. The normal flow
  still uses one initial form/checkout and a separate service-payment link;
  customers need not re-enter their details.

## Completed result and cleanup

The live **customer/payment** phone audit passed. It covered native WhatsApp,
Firefox, both languages/expiry, real GPS and customer fields, two actual myPOS
payments, the hosted Cron worker, automatic staff updates, safe service-link
reissue, private photo upload/staff display/access rejection/removal, and a
no-charge correction submission. Driver login, assignment and operational
progression were not repeated in this audit; no driver/operator was created.

- The phone's Remove control deleted both the uploaded photo row and its
  Storage object. No orphan remained (object-key fingerprint
  `92b9f3e3e21a16c74b33edde93fab550`).
- The phone submitted the correction at **22:32:19 UTC** without a new payment.
  Exactly two requests remain, both numeric 4/Paid, totaling 70 ISK for this
  audit. The first frozen draft's original completion time stayed unchanged.
- Cancelled only the owned audit job using the normal staff status control.
  Its two real Paid records remain intact in history. No refund was performed.
  The original three staff profiles remain, with zero operators/assignments.
- Removed the synthetic phone file and confirmed its MediaStore entry is gone.
  Restored the exact original display setting `3`; the owned TCP 9230 forward
  was removed. Personal phone tabs and browser preferences were preserved.
- Removed the temporary 35 ISK deployment. The stable public alias remains on
  `vegstod-gyj57bol4-freyrs-projects-fad4047a.vercel.app`; its fee is 10,490 ISK.
  The hosted minute worker remains active and returns HTTP 200.
- Closed the four owned desktop verification browsers. Private evidence is in
  ignored `output/mypos-live-phone-20261021/`, `output/playwright/`, and the
  owner-only `~/.config/vegstod/mypos/hosted-phone-audit-20261021.json` ledger.
  No card data was captured, stored or entered by automation.

No application code changes were needed during this audit. The test-only
deployment varied only its fee environment value; the project-wide configuration
and ordinary customer pricing were preserved. The source changes were still
uncommitted at the end of this audit. The subsequent 22 October Git checkpoint
records the release with automatic Git deployments disabled; see the
[deployment runbook](deployment.md).
