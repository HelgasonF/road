# Meta MCP / WhatsApp resume checkpoint

Updated: 11 September 2026 (Atlantic/Reykjavik)

This is the authoritative restart point for the Meta WhatsApp setup. Read this file before using the Meta Social Technologies MCP or changing any WhatsApp asset.

## Repository and deployment

- Repository: `/mnt/ssd4tb/web-apps/Road`
- Branch: `chore/vercel-git-connection`
- Stable preview: `https://vegstod.vercel.app`
- Supabase project: `abpmzqtbllszqqetuubp`
- Public webhook: `https://abpmzqtbllszqqetuubp.supabase.co/functions/v1/whatsapp-webhook-v1`
- The latest completed repository work is the WhatsApp webhook foundation, staff-only subscription management function, patched Next.js 16.3.5 upgrade, and live sandbox inbound verification.

## Verified Meta assets

These are separate assets and must not be confused:

### Existing Meta app

- Name: `Iceland road assistance`
- App ID: `1403947388469576`
- Owner: Iceland Road Assistance business portfolio
- The app is valid; do not create a replacement app unless a later MCP audit proves an ownership problem.

### Real organization WhatsApp Business Account

- WABA ID: `931911699982634`
- Number: `+354 853 7704`
- Display name: `Iceland road assistance`
- Meta Business Settings currently labels the asset `WhatsApp Business App` and showed the number as `Offline` on 11 September.
- This is the intended production sender.
- Do not delete, deregister, migrate, or replace this number until the MCP audit confirms the supported connection path and its effect on the existing WhatsApp Business app.

### Meta sandbox WhatsApp Business Account

- WABA ID: `1799725827819599`
- Test sender: `+1 555-601-6830`
- Test Phone Number ID: `1251932438011191`
- This is the WABA currently configured in the Supabase WhatsApp secrets.
- Outbound sandbox delivery succeeded. A fresh physical-phone reply reached `whatsapp-webhook-v1` as a signed `messages` event and was persisted once in `whatsapp_webhook_events` for the expected test WABA.
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

OAuth completed before this checkpoint. The Codex App must restart before the current tool registry can expose the Meta MCP tools. If Meta requests OAuth again after restart, complete it and select the existing `Iceland road assistance` app.

## First actions after restart

1. Confirm the Meta MCP server tools are available. The server documentation says there should be 11 tools.
2. Use the read-only app-list tool first and locate App ID `1403947388469576`.
3. Read the app configuration, ownership, App Review/compliance state, webhook topics, and current subscriptions.
4. Determine what the MCP can see for WABA `931911699982634` and whether the existing app is connected to it. Do not infer the real WABA relationship from the sandbox subscription.
5. Compare the MCP results with the asset list above and report the exact mismatch before using a Manage operation.
6. Use Manage only for a reviewed webhook subscription or test payload. Meta's MCP Manage scope cannot assign business assets, register phone numbers, generate System User tokens, or send production WhatsApp messages.

## Safe correction order

1. Keep the existing app and sandbox unchanged.
2. Establish whether the real WABA can keep using the WhatsApp Business app while adding Cloud API access. Stop before any migration/deregistration confirmation if the answer is unclear.
3. Ensure the real WABA is owned by the same business portfolio and assigned to the correct System User/app using Meta Business Settings where MCP cannot manage assets.
4. Obtain and verify the real Phone Number ID and a permanent token scoped to the real WABA without exposing either credential.
5. Store separate sandbox and production identifiers in Supabase; do not overwrite the sandbox until production validation succeeds.
6. Subscribe the real WABA to the existing signed webhook and send a Meta test payload.
7. Register reusable customer-intake, driver-availability, and assignment/access templates once; Vegstoð will fill variables and send operational messages.
8. Build the idempotent outbound outbox and webhook status/reply processor while preserving the current manual `wa.me` fallback.
9. Run the full physical-phone customer and driver workflow before switching the active sender.

## Security boundary

No App Secret, access token, webhook verification token, Supabase key, OAuth code, or user credential belongs in this file or Git. Existing protected values remain in Supabase Edge Function secrets or the Codex OAuth credential store.
