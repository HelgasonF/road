# Meta MCP / WhatsApp audit

Audited: 11 September 2026, approximately 21:31 UTC (Atlantic/Reykjavik).

Starting point: commit `29a92fd` on `chore/vercel-git-connection`, using the [resume checkpoint](meta-mcp-resume-2026-09-11.md).

## Result

The restart succeeded. All 11 Meta Social Technologies MCP tools are available, and OAuth permits read/manage access to the existing `Iceland road assistance` app, `1403947388469576`, with viewer role `admin`. No restricted/deactivated status was reported.

The app has an enabled WhatsApp `messages` subscription and no reported compliance violations. The production WABA's connection, ownership, and phone registration remain unverified: this MCP exposes app configuration, not WABA asset records. Nothing in this audit establishes an ownership problem or justifies replacing the existing app.

All Meta operations were read-only. No webhook test was sent, subscription changed, token generated, number registered/migrated/deregistered, Supabase secret changed, or deployment performed. The previous physical-phone sandbox test remains historical evidence from the checkpoint; it was not repeated here.

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
| Production WABA `931911699982634`, number `+354 853 7704` | WhatsApp Business App asset, shown Offline | MCP has no WABA/phone lookup action. Current owner, subscribed apps, phone ID, registration state, and coexistence eligibility remain unknown. |
| Sandbox WABA `1799725827819599`, phone ID `1251932438011191` | Configured in Supabase; outbound and signed inbound phone test passed | No WABA-scoped record was returned or Supabase configuration inspected in this audit. Existing sandbox evidence is preserved. |

The exact gap is between a configured **app webhook** and a proven **production WABA-to-app subscription**. The enabled `messages` subscription contains no WABA ID. It proves neither that the real WABA is connected nor that it is disconnected.

The 11 tools cover app settings/listing, App Review, compliance, API usage/changelog, documentation discovery, webhook listing/management/testing, and workflow telemetry. None provides business-asset assignment, WABA/phone reads, System User token generation, or a general Graph API call. No WABA ID was substituted for an App ID.

## Supported connection path and qualifications

Meta documents **Coexistence** through Embedded Signup for existing WhatsApp Business app numbers. It preserves phone-app use while adding Cloud API. The integration-side requirements include a Solution Partner or Tech Provider setup; this app's eligibility was not established. The guide says to skip phone registration during this onboarding path because the number is already registered. It also requires preparation for `history`, `smb_app_state_sync`, and `smb_message_echoes`, with a 24-hour contact/history synchronization window. Coexistence affects features: for example, disappearing messages are disabled for individual chats, and group chats are not synchronized to Cloud API. These effects need review before connecting the real number. [Meta coexistence guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)

After onboarding, Meta documents `is_on_biz_app: true` together with `platform_type: CLOUD_API` on the **real phone number ID** as confirmation of coexistence. Neither value has been read for `+354 853 7704`. [Coexistence status check](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)

Do not treat the missing App Review submission as a universal blocker: Meta says a Direct Developer using the API for their own business does not need Advanced Access or App Review. Apps serving other businesses have different requirements. This distinction does not itself establish eligibility to offer the coexistence onboarding flow. [Meta App Review guidance](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/app-review/)

## Next checks before any production change

1. In Meta Business Settings, inspect the existing app and WABA `931911699982634`. Record each owning business ID and compare them, then inspect existing System User/partner assignments. Do not create replacement assets from an assumption about ownership.
2. Confirm an eligible coexistence onboarding route for the existing number and how that route will connect to the existing app. Review its phone-app effects and prepare webhook processing before starting its synchronization window.
3. With appropriate WABA-scoped access, perform a read-only `GET /{Version}/931911699982634/subscribed_apps`. Look for `whatsapp_business_api_data.id` equal to `1403947388469576` and any callback override. An empty response is evidence of no subscriptions; a permission error is not. [Subscribed Apps API](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/subscribed-apps-api)
4. Read the real WABA's phone-number records using WhatsApp Manager or authorized Graph API access. Match `+354 853 7704`, record its Phone Number ID, and read `is_on_biz_app`/`platform_type`. Never substitute test phone ID `1251932438011191`.
5. Only after those checks, prepare the appropriate subscription/configuration change and production phone test. Keep the sandbox working and credentials out of chat, source, and audit documents.

The remaining access gap is WABA-level evidence through Business Settings/WhatsApp Manager or an appropriately authorized Graph API connection. Another Codex restart is not needed to expose the already functioning Meta MCP tools.

## Audit trace

Executed `devtools_app_list(list)` first, then `devtools_app(basic_settings, advanced_settings, restrictions)`, `devtools_app_review(status, privileges, requirements)`, `devtools_compliance(status)`, and `devtools_webhook_list(list_topics, list_subscriptions)` for app `1403947388469576`.

Consulted `devtools_discovery(search_docs)` and the server's `devtools://guides/compliance` resource. Official documentation excerpts were retrieved through Meta MCP; direct web retrieval of the coexistence/Embedded Signup pages returned HTTP 429. A resource-template enumeration returned `Transport closed`; subsequent resource reads and Meta tool calls succeeded. Neither auxiliary failure prevented the app audit.
