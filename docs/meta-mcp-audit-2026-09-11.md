# Meta MCP / WhatsApp audit

Audited: 11 September 2026, approximately 21:31 UTC (Atlantic/Reykjavik).

Starting point: commit `29a92fd` on `chore/vercel-git-connection`, using the [resume checkpoint](meta-mcp-resume-2026-09-11.md).

## Result

The restart succeeded. All 11 Meta Social Technologies MCP tools are available, and OAuth permits read/manage access to the existing `Iceland road assistance` app, `1403947388469576`, with viewer role `admin`. No restricted/deactivated status was reported.

The app has an enabled WhatsApp `messages` subscription and no reported compliance violations. The original MCP audit could not inspect production WABA records because the MCP exposes app configuration rather than business assets. A later authorized Graph API inspection, recorded below, closed that evidence gap without changing the real account.

During the original MCP audit, all Meta operations were read-only. No webhook test was sent, subscription changed, token generated, number registered/migrated/deregistered, Supabase secret changed, or deployment performed. The previous physical-phone sandbox test remains historical evidence from the checkpoint; it was not repeated there. The later Supabase inspection deployment is recorded separately below.

## Follow-up production WABA inspection

At approximately 21:47 UTC, Meta Business Settings showed that the existing `Employee` System User has full access to the existing app, the production WABA, and the sandbox WABA. `Employee` is the server identity used by the permanent token; it is not a human employee account.

Vegstoð then deployed an additive, staff-only, read-only action in `whatsapp-management-v1`. After `is_staff()` authorization, that action used the existing permanent token to read the production WABA's phone records and subscribed apps. It returned only selected non-secret metadata:

| Field | Verified value |
| --- | --- |
| Production WABA | `931911699982634` |
| Number | `+354 853 7704` |
| Phone Number ID | `1209825652224082` |
| Existing WhatsApp Business app | `is_on_biz_app: true` |
| Platform | `ON_PREMISE` |
| Verification | `NOT_VERIFIED` |
| Connection | `DISCONNECTED` |
| Quality | `UNKNOWN` |
| Apps subscribed to this WABA | none |

This proves that the permanent token inherited the new WABA asset access and that the identifiers belong together. It also proves that Cloud API/coexistence onboarding is not complete: the expected completed coexistence state is `is_on_biz_app: true` together with `platform_type: CLOUD_API`. The real number has not been subscribed to the existing Meta app.

No production subscription was created, no message was sent, and the real number was not registered, migrated, deregistered, or selected as Vegstoð's active sender. The sandbox WABA and Phone Number ID remain active. Supabase now holds the production WABA ID separately so future inspections cannot overwrite or confuse the sandbox configuration.

## Live observations

| Check | MCP result | Interpretation |
| --- | --- | --- |
| App identity/access | `1403947388469576`, `Iceland road assistance`, `admin`, permissions `read` and `manage` | Matches the checkpoint's app. MCP management access is not WhatsApp messaging/token access. |
| App mode | `app_status: dev_mode`, `is_live: false` | The app is in development mode. |
| Basic configuration | `contact_email_verified: false`; privacy policy, terms, data deletion, support URLs and base domains absent | Configuration gaps to review before the applicable launch/onboarding process. |
| Advanced configuration | Auth/deauth callback URLs, OAuth redirect URIs and JS SDK host domains absent | No values were returned for these settings; no Embedded Signup configuration was inspected. |
| App Review | `NO_SUBMISSION`; no pending submission; privileges/rejections arrays empty | No review submission or review privileges were reported. This is not a complete inventory of token permissions. |
| Review requirements | `can_submit: true`; `has_privacy_policy: false`; `business_verification_passes: false` | Submission is allowed by this tool, but the two checks do not pass. It does not identify the owning business or explain the verification failure. |
| Compliance | `compliant`; no required actions, open violations, or recommendations | No current compliance action is reported. This does not certify production readiness. |
| Restrictions | No location restrictions; empty age restriction; alcohol restriction false | No additional restriction was exposed in these fields. |
| Webhook subscription | One enabled `whatsapp_business_account` subscription; fields `messages`; `include_values: true` | App-level message webhook is configured. |
| Callback | MCP returned `https://abpmzqtbllszqqetuubp.supabase.co/...` | Host matches the expected Supabase project. MCP masks the path, so it does not independently verify the complete webhook URL. |

`list_topics` includes `whatsapp_business_account` and fields such as `messages`, `history`, `smb_app_state_sync`, `smb_message_echoes`, and `account_update`. Topic availability does not mean the app is subscribed to all those fields: the actual subscription contains only `messages`.

## Asset evidence boundary

| Asset | Previously recorded | Established by this audit |
| --- | --- | --- |
| App `1403947388469576` | Owned by Iceland Road Assistance portfolio | App identity and user admin role confirmed; owning business ID is not returned by the inspected MCP settings. |
| Production WABA `931911699982634`, number `+354 853 7704` | WhatsApp Business App asset, shown Offline | Follow-up Graph inspection verified Phone Number ID `1209825652224082`, token access, `is_on_biz_app: true`, platform `ON_PREMISE`, state `DISCONNECTED`/`NOT_VERIFIED`, and no subscribed apps. |
| Sandbox WABA `1799725827819599`, phone ID `1251932438011191` | Configured in Supabase; outbound and signed inbound phone test passed | No WABA-scoped record was returned or Supabase configuration inspected in this audit. Existing sandbox evidence is preserved. |

The exact gap is now confirmed: the app-level `messages` webhook exists, while the production WABA has no subscribed app and its number has not completed Cloud API/coexistence onboarding.

The 11 tools cover app settings/listing, App Review, compliance, API usage/changelog, documentation discovery, webhook listing/management/testing, and workflow telemetry. None provides business-asset assignment, WABA/phone reads, System User token generation, or a general Graph API call. No WABA ID was substituted for an App ID.

## Supported connection path and qualifications

Meta documents **Coexistence** through Embedded Signup for existing WhatsApp Business app numbers. It preserves phone-app use while adding Cloud API. The integration-side requirements include a Solution Partner or Tech Provider setup; this app's eligibility was not established. The guide says to skip phone registration during this onboarding path because the number is already registered. It also requires preparation for `history`, `smb_app_state_sync`, and `smb_message_echoes`, with a 24-hour contact/history synchronization window. Coexistence affects features: for example, disappearing messages are disabled for individual chats, and group chats are not synchronized to Cloud API. These effects need review before connecting the real number. [Meta coexistence guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)

After onboarding, Meta documents `is_on_biz_app: true` together with `platform_type: CLOUD_API` on the **real phone number ID** as confirmation of coexistence. The follow-up inspection returned `is_on_biz_app: true` and `platform_type: ON_PREMISE`, so onboarding is not complete. [Coexistence status check](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)

Do not treat the missing App Review submission as a universal blocker: Meta says a Direct Developer using the API for their own business does not need Advanced Access or App Review. Apps serving other businesses have different requirements. This distinction does not itself establish eligibility to offer the coexistence onboarding flow. [Meta App Review guidance](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/app-review/)

## Next production steps

A later product decision established that the business does not need to retain WhatsApp Business phone-app messaging: customers make cellular calls to `+354 853 7704`, then Vegstoð sends customer and driver links through Cloud API. The Coexistence analysis above remains the historical answer to the earlier requirement, but it no longer controls implementation. The current authoritative sequence is in [the resume checkpoint](meta-mcp-resume-2026-09-11.md): finish the sandbox backend and templates, back up any required phone-app chats, release the number at final cutover, register it directly with Cloud API, subscribe the real WABA, and run the physical-phone production test. Independent Tech Provider onboarding is not part of this route.

## Audit trace

Executed `devtools_app_list(list)` first, then `devtools_app(basic_settings, advanced_settings, restrictions)`, `devtools_app_review(status, privileges, requirements)`, `devtools_compliance(status)`, and `devtools_webhook_list(list_topics, list_subscriptions)` for app `1403947388469576`.

Consulted `devtools_discovery(search_docs)` and the server's `devtools://guides/compliance` resource. Official documentation excerpts were retrieved through Meta MCP; direct web retrieval of the coexistence/Embedded Signup pages returned HTTP 429. A resource-template enumeration returned `Transport closed`; subsequent resource reads and Meta tool calls succeeded. Neither auxiliary failure prevented the app audit.
