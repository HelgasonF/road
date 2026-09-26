# WhatsApp sandbox phone audit — 13 September 2026

Audited: approximately 10:56–11:02 UTC / Atlantic/Reykjavik.

Follow-ups at 11:34–12:02 UTC: the template-language mismatch was corrected and all three operational templates reached `delivered`. A new physical phone passed availability replies and driver access/acceptance. Its customer button exposed a malformed Meta URL, corrected in place and awaiting review at 12:02 UTC. The initial observations below are retained as morning audit history.

This is the latest follow-up to the [12 September production handoff](whatsapp-production-handoff-2026-09-12.md). It updates the production-number decision and records fresh sandbox evidence. The earlier handoff still owns the reviewed manual template definitions and parameter order.

## Current user direction

- The user reports completing Meta's **Step 2. Production setup**, but believes it does not apply to `+354 853 7704`. The account selected for billing and its payment state were not independently inspected in this audit.
- The permanent business sender is still undecided. The user is considering a more memorable business number; do not treat a cutover of `+354 853 7704` as the only remaining route or start registration or number release automatically.
- Continue testing from sandbox sender `+1 555-601-6830` to the user's test phone `+354 659 7003`.
- The connected Samsung SM-S918B had WhatsApp open in the sandbox conversation. The user authorized further tests with this phone.

## Live configuration checks

- Meta MCP still grants admin read/manage access to the existing `Iceland road assistance` app, `1403947388469576`.
- A hosted staff session passed `is_staff()` and invoked the existing read-only production inspection.
- WABA `931911699982634` still returned number `+354 853 7704`, Phone Number ID `1209825652224082`, `ON_PREMISE`, `DISCONNECTED`, `NOT_VERIFIED`, `isOnBizApp: true`, and no subscribed apps.
- Fresh signed inbound events identified sandbox WABA `1799725827819599` and Phone Number ID `1251932438011191`.
- The local `.env.local` points to local Supabase. Hosted verification used the linked project's public API key and a separate staff session; local configuration was not changed.

## Verified sandbox behavior

1. The deployed `whatsapp-send-v1` accepted one fresh `hello_world` message to the test recipient at 10:56. The phone displayed it, and signed `sent` and `read` events advanced the hosted ledger to `read` with `attempt_count = 1`.
2. Repeating the identical request with the same idempotency key returned the same message with `deduplicated: true`; no duplicate was sent.
3. A new plain `Laus` reply from the phone reached the signed webhook and was classified `available`. This was a generic test conversation, not a job-correlated availability-template test.
4. A real `STOP` reply changed the recipient preference to `opted_out`. A fresh outbound request returned HTTP 409 `recipient_opted_out`, and no outbound ledger row was created for its idempotency key.
5. A subsequent real `START` reply restored the preference to `allowed`. A second fresh `hello_world` message was accepted and reached `read`, again with one attempt. The phone is left opted in for further testing.

## Initial customer-template rejection

The hosted dispatcher UI created a separate phone-only request through **Búa til og senda WhatsApp**. It attempted:

```text
Template: iceland_road_assistance_customer_intake_v1
Language: en_US
Recipient: +354 659 7003
Meta error: 132001
```

Meta rejected the template before delivery. The job and fresh 24-hour link remained available, the pending request stayed outside assignment, and the dialog displayed **Opna WhatsApp handvirkt**. No manual fallback message was sent. The browser reported zero console errors or warnings.

Meta documents `132001` as a template missing in the requested language or not approved. The error alone did not establish whether the record was absent, under review, rejected, named differently, or located in a different WABA. The later follow-up confirmed that the requested `en_US` was wrong for the manually created `en` templates. [Meta error reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes)

The driver availability and assignment templates were not sent in the morning audit; both were verified in the follow-up below. Do not recreate the deleted `vegstod_*` templates or replace the manually reviewed definitions.

## Cleanup and evidence

- Deleted only the disposable failed customer-message ledger row and its pending job in a guarded transaction. Follow-up counts confirmed zero remaining job, customer-link, billing, and failed-message rows for that test.
- No provider, driver identity, assignment, or photo was created. Existing presentation and stakeholder data was preserved.
- Retained the two successful sandbox message records, delivery events, signed replies, and resulting `allowed` preference as real test evidence.
- Non-secret test identifiers and results are stored outside Git in `~/.config/vegstod/whatsapp-sandbox-2026-09-13/`.
- No application code, Meta configuration, phone registration, template, Supabase secret, or deployment was changed. Repository documentation is the only source change; application build/test suites were not rerun for this live configuration audit.

## Next work recorded after the morning audit

1. Inspect the three `iceland_road_assistance_*` records under **Test WhatsApp Business Account** (`1799725827819599`), recording their exact names, languages, IDs, and review states.
2. Resolve the customer-template `132001` against that evidence, then test customer intake, job-correlated availability replies, and assignment/access through the hosted interface and physical phone.
3. Select the permanent company-owned sender separately. Meta requires an eligible number under the business's control that can receive verification by SMS or voice; suitability of a particular replacement number has not been checked. [Meta phone-number requirements](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers)

## Language correction and operational-template delivery

The user's WhatsApp Manager screen showed the three manually created `iceland_road_assistance_*` templates under **Test WhatsApp Business Account**, with language **English** and status **Active – Quality pending**. The user confirmed those were the three templates they created and authorized changing Vegstoð to `en`.

Meta's language table distinguishes English (`en`) from English (US) (`en_US`). **Active – Quality pending** means approved and sendable, with insufficient customer quality feedback; it does not mean pending approval. The previous handoff's `English = en_US` statement was incorrect. [Supported languages](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/supported-languages/), [template status](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)

Changed and verified only these three Supabase language settings:

```text
WHATSAPP_TEMPLATE_CUSTOMER_INTAKE_LANGUAGE=en
WHATSAPP_TEMPLATE_DRIVER_AVAILABILITY_LANGUAGE=en
WHATSAPP_TEMPLATE_DRIVER_ASSIGNMENT_LANGUAGE=en
```

`whatsapp-send-v1` already reads these settings, so no application-code change or deployment was required. The generic `hello_world` language remains `en_US`. Template names, Meta records, message content, sender number, and credentials were unchanged.

Fresh requests to the deployed staff-authorized function produced these signed delivery confirmations for `+354 659 7003`:

| Purpose | Language | Delivered at (UTC) | Attempt count | Error |
| --- | --- | --- | --- | --- |
| Customer intake | `en` | 11:34:36 | 1 | None |
| Driver availability | `en` | 11:36:06 | 1 | None |
| Driver assignment/access | `en` | 11:36:35 | 1 | None |

The customer request used a fresh hashed intake link and zero body parameters. Availability used a separate test job/provider and all five body parameters. Assignment used that provider's actual assignment, four body parameters, and a newly generated one-time driver-access URL suffix. All three progressed through `sent` to `delivered`; none required a retry.

The phone was no longer connected through ADB during the initial delivery follow-up. Delivery in that pass is proven by Meta's signed webhooks. The user subsequently connected a different phone for the interaction checks below.

Non-secret identifiers and delivery evidence are saved outside Git in `~/.config/vegstod/whatsapp-locale-fix-2026-09-13/`.

## New phone: buttons, driver access, and customer URL correction

The user connected a Samsung SM-G990B2 running WhatsApp with the same recipient number, `+354 659 7003`. Fresh customer, availability, and assignment messages all reached `read`, with one attempt each and no send error.

- **Available**, pressed in WhatsApp, reached the signed webhook at 11:54:14 UTC and was classified `available`.
- **Unavailable**, pressed on the same template, reached it at 11:57:40 UTC and was classified `unavailable`. Both replies correlated to the exact outbound availability message, test job, and provider. They remained non-binding replies; the provider's availability stayed `available`.
- **Open assigned job** opened the real template URL in the phone's Firefox browser. **Opna ökumannsskjá** redeemed the one-time Auth link, signed in the temporary driver, and displayed its assigned job and customer/location details. **Samþykkja** persisted `accepted_at = 2026-09-13T12:00:47.90443Z`. WhatsApp temporarily disabled its link button after an initial tap; reopening the chat restored it. The successful check used the actual button URL without manual repair.
- **Open secure request** opened the customer page but displayed **This link is no longer available**. Inspection of the clicked URL and Meta's saved template showed a literal encoded `{{1}}` before the real token. The newly created database link was still active and unsubmitted; the malformed URL failed its token lookup.

The prior handoff incorrectly instructed typing `{{1}}` into WhatsApp Manager's Dynamic Website URL field. Meta already appends that variable beside the field. Corrected the existing customer template (ID `1005863479172773`) from `https://vegstod.vercel.app/customer/%7B%7B1%7D%7D` to the base `https://vegstod.vercel.app/customer/`, retained its sample URL and other content, and submitted it for review. It showed **In review** at 11:48 and again after refresh at 12:02 UTC. This review state is distinct from **Active – Quality pending**.

The assignment template (ID `2115788352358661`) already used the correct base `https://vegstod.vercel.app/driver/access?code=`. Its samples and footer were correct; it was inspected without saving changes. Both driver templates remained active. No application code or deployment was needed for either the locale settings or customer-template correction.

Remaining check: after customer-template approval, send a fresh customer template with a new link and complete the intake form from its actual WhatsApp button. Existing delivered messages retain the malformed URL. Production sender selection remains separate.

Phone screenshots are saved under `~/Pictures/Screenshots/vegstod-new-phone-driver-2026-09-13.png` and `vegstod-new-phone-driver-accepted-2026-09-13.png`; the current Meta status is in `vegstod-meta-template-status-2026-09-13.png`. They contain only disposable test details, with no bearer token shown. The protected audit directory contains message/reply IDs and saved database evidence; no credentials or raw access URLs belong in Git.

## Follow-up cleanup

At 12:06 UTC, signed out the temporary driver on the phone, disabled its access, and removed only the two disposable jobs, their customer links/billing/history, one assignment, test provider, six normalized outbound messages, related delivery events, and two correlated quick replies. Guarded SQL verified the exact test IDs, labels, unsubmitted customer state, accepted driver assignment, absent photos, and absence of preference dependencies before deletion. Follow-up counts were zero for the jobs, links, billing, provider, assignment, and outbound messages. The temporary Auth user and cascading profile were then deleted through the admin API.

The earlier generic sandbox messages, signed webhook envelopes, STOP/START evidence, `allowed` recipient preference, and retained demonstration/stakeholder data were preserved. Non-secret delivery, correlation, acceptance, and cleanup results remain outside Git. The audit's staff session was logged out, and its local credentials and captured bearer URL were removed; the phone is back on the login page. A later customer test must create a new disposable job and fresh link after Meta approves the corrected template.
