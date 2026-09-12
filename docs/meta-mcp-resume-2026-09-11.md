# Meta MCP / WhatsApp resume checkpoint

Updated: 12 September 2026 (Atlantic/Reykjavik)

This file preserves the Meta MCP and asset-discovery checkpoint. The newer [`whatsapp-production-handoff-2026-09-12.md`](whatsapp-production-handoff-2026-09-12.md) is authoritative for the manual templates, current Meta checklist, code alignment, and production cutover sequence.

## Repository and deployment

- Repository: `/mnt/ssd4tb/web-apps/Road`
- Branch: `chore/vercel-git-connection`
- Stable preview: `https://vegstod.vercel.app`
- Supabase project: `abpmzqtbllszqqetuubp`
- Public webhook: `https://abpmzqtbllszqqetuubp.supabase.co/functions/v1/whatsapp-webhook-v1`
- The latest completed repository work is the WhatsApp webhook foundation, normalized delivery/reply processing, idempotent outbound send ledger and Edge Function, staff-only subscription management, patched Next.js 16.3.5 upgrade, and live sandbox inbound verification.

## Verified Meta assets

These are separate assets and must not be confused:

### Existing Meta app

- Name: `Iceland road assistance`
- App ID: `1403947388469576`
- Owner: Iceland Road Assistance business portfolio
- The app is valid; do not create a replacement app unless a later MCP audit proves an ownership problem.

### Unused replacement app

- A second development-mode app named `Vegstoð` (App ID `948727494391424`) was created while investigating the missing production-number bridge.
- Its Independent Tech Provider onboarding is unnecessary for the agreed direct API design. Do not continue its business-verification flow or upload anyone's identity document for this purpose.
- It has not replaced the original app or changed either phone number. Leave it unused until the owner chooses to archive it after the production connection succeeds.

### Real organization WhatsApp Business Account

- WABA ID: `931911699982634`
- Number: `+354 853 7704`
- Display name: `Iceland road assistance`
- Meta Business Settings currently labels the asset `WhatsApp Business App` and showed the number as `Offline` on 11 September.
- The existing `Employee` System User now has full access to this WABA as well as the existing Meta app and sandbox WABA. It is a server identity, not a human employee account.
- A staff-authorized Graph read verified Phone Number ID `1209825652224082`, `is_on_biz_app: true`, platform `ON_PREMISE`, state `DISCONNECTED`/`NOT_VERIFIED`, and no subscribed apps. The permanent token can access the asset, but direct Cloud API registration is not complete.
- This is the intended production sender.
- Do not release its WhatsApp Business phone-app registration until the approved templates, outbound backend, and sandbox tests are ready. Back up any chats that must be retained immediately before the planned Cloud API cutover.
- Set its Meta business/WABA time zone to `Atlantic/Reykjavik` (`UTC+00:00`) if prompted.

### Meta sandbox WhatsApp Business Account

- WABA ID: `1799725827819599`
- Test sender: `+1 555-601-6830`
- Test Phone Number ID: `1251932438011191`
- This is the WABA currently configured in the Supabase WhatsApp secrets.
- The deployed `whatsapp-send-v1` function delivered a fresh `hello_world` template to a physical phone and the hosted webhook advanced it through `sent` and `read`.
- Plain **Laus** was stored as `available`; quoted **Ekki laus** was stored as `unavailable` and correlated to the exact outbound request. An identical retry was deduplicated without a second send, and a changed payload under the same key was rejected with HTTP 409. See [`docs/whatsapp-sandbox-phone-audit-2026-09-11.md`](whatsapp-sandbox-phone-audit-2026-09-11.md).
- The staff-only management function created three early `vegstod_*` templates in `en_US`. Their branding, wording, and button samples were wrong, and the user deleted all three in Meta on 12 September. Their former Meta IDs and pending states are historical only.
- Replacement `iceland_road_assistance_*` templates were entered manually and their names/languages were installed as Supabase secrets. The exact content, samples, known status, and required final assignment-template check are recorded in the newer production handoff.
- The dispatcher UI is wired to send the replacement templates through `whatsapp-send-v1` while keeping its manual `wa.me` fallback. The customer and assignment buttons carry only the expiring Vegstoð token suffix; exact locations, customer details, and photos remain inside Vegstoð.
- The main matching list and staff timeline now surface correlated replies and Meta-confirmed delivery state without changing assignments. Signed STOP/START equivalents maintain the current contact preference, and the database rejects opted-out sends before Meta delivery.
- Keep this working sandbox intact until the real account passes its complete phone test.

## Meta MCP connection

The Codex global MCP server configuration has been added:

```text
Name: meta_social_technologies
Transport: streamable_http
URL: https://mcp.facebook.com/devtools
Authentication: OAuth
Requested scopes: developer_tools_mcp_app_read, developer_tools_mcp_app_management
```

OAuth completed before the original checkpoint. The restart was verified successful on 11 September 2026: all 11 Meta MCP tools are now available, and the existing `Iceland road assistance` app is accessible with admin role and read/manage permissions. No further restart or OAuth prompt was needed for the audit.

## Completed MCP audit after restart

Read the [Meta MCP audit](meta-mcp-audit-2026-09-11.md) for the historical live observations and evidence limits. Its original Coexistence recommendation was superseded by the product decision below.

- The app is in development mode, has no reported compliance violations, and has one enabled `whatsapp_business_account` subscription for `messages`.
- MCP masks the callback path and returns no WABA IDs in that subscription. The later staff-only Graph inspection established the production phone record and confirmed that the real WABA currently has no app subscription.
- Privacy/deletion URLs are missing; contact email is unverified; App Review reports no submission and a failed business-verification check. These are recorded facts, not proof that every own-business integration requires App Review.
- Meta documents Coexistence for retaining WhatsApp Business phone-app use while adding Cloud API. Vegstoð does not require that retained phone-app use, so its Tech Provider prerequisites do not apply to the selected design.
- The System User's real-WABA asset assignment is complete, and Supabase stores the production WABA ID separately for read-only inspection. No production subscription, message, number registration, migration, deregistration, or sender switch occurred.

## Product decision after the audit

Customers will make normal cellular calls to `+354 853 7704`. A dispatcher will read caller ID, enter the customer number into Vegstoð, and send the intake link from Vegstoð through Cloud API. Driver messages follow the same server-side channel. The WhatsApp Business phone app does not need to remain registered after production cutover; cellular calls and SMS on the SIM are independent and continue normally.

This makes direct Cloud API registration through the existing `Iceland road assistance` developer app the intended route. Coexistence, Embedded Signup for client businesses, Independent Tech Provider verification, and a paid BSP are unnecessary. The phone-app registration is released only at the final cutover because that ends its WhatsApp-app use and may affect chat history.

Meta may still require verification of the tow-truck company's own business portfolio or an authorized representative before production registration. That is separate from becoming a Tech Provider. If Meta requires it, the owner or another authorized company representative completes it in the company's portfolio; the external developer does not claim personal ownership of the company.

## Original audit sequence (retained for reference)

1. Confirm the Meta MCP server tools are available. The server documentation says there should be 11 tools.
2. Use the read-only app-list tool first and locate App ID `1403947388469576`.
3. Read the app configuration, ownership, App Review/compliance state, webhook topics, and current subscriptions.
4. Determine what the MCP can see for WABA `931911699982634` and whether the existing app is connected to it. Do not infer the real WABA relationship from the sandbox subscription.
5. Compare the MCP results with the asset list above and report the exact mismatch before using a Manage operation.
6. Use Manage only for a reviewed webhook subscription or test payload. Meta's MCP Manage scope cannot assign business assets, register phone numbers, generate System User tokens, or send production WhatsApp messages.

## Safe correction order

1. Keep the original app, real WABA, and working sandbox; stop the replacement app's Tech Provider flow.
2. Keep the deployed idempotent outbound ledger, normalized webhook status/reply processor, and manual `wa.me` actions intact.
3. Recheck the three manual `iceland_road_assistance_*` templates in WhatsApp Manager. Correct the assignment template's `{{3}}` sample/footer if needed, submit it, and record the real Meta statuses and IDs.
4. Have the company owner add billing to the WABA that will own the production Cloud API number and complete the company's separate business-verification step. The owner can do both from Meta Business Settings without developer-app access.
5. Run the approved templates through their full sandbox phone paths. The generic physical-phone send/read/reply/idempotency path, local and hosted fallback, provider rejection, delivery/reply timeline, and opt-out guard already pass.
6. Immediately before cutover, export any WhatsApp Business phone-app chats the owner needs to retain.
7. Release `+354 853 7704` from the WhatsApp Business phone app and register that same number directly in Cloud API with Meta's SMS/voice code.
8. Subscribe production WABA `931911699982634` to the existing signed webhook, switch the active Phone Number ID only after verification, and run the full physical-phone customer and driver workflow.
9. Keep the manual WhatsApp and call actions available until the owner accepts the production test. Do not use Embedded Signup Builder for this direct single-company integration.

## Security boundary

No App Secret, access token, webhook verification token, Supabase key, OAuth code, or user credential belongs in this file or Git. Existing protected values remain in Supabase Edge Function secrets or the Codex OAuth credential store.
