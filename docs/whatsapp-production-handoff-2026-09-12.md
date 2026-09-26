# WhatsApp production handoff — 12 September 2026

Updated: 26 September 2026, Atlantic/Reykjavik. Original handoff: 12 September 2026.

**Requirement changed, 26 September:** the owners need WhatsApp voice calls to keep ringing in the WhatsApp Business phone app while Vegstoð uses API messaging on the same number. The direct Cloud API cutover instructions below are historical and must not be followed for this number. Meta's standard **Add your WhatsApp phone number** screen rejected the newly used phone-app number with `#2655122` because it is already registered. Do not delete or disconnect the phone-app account. The active route is [WhatsApp Business app coexistence via Embedded Signup](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users), offered by a Solution Partner or eligible Tech Provider. Meta documents that voice and video calls continue in the phone app. A provider/implementation has not yet been selected, the exact number has not been reconfirmed, and no production asset or Supabase sender secret has changed. Check the number's WhatsApp Business app age and the intended WABA before onboarding; then verify `is_on_biz_app: true` with `platform_type: CLOUD_API`, production templates, webhooks, and the complete phone workflow before switching the sender.

Latest result, 14 September: the [hosted end-to-end audit](whatsapp-e2e-audit-2026-09-14.md) **passed** after template approval. The corrected customer button, phone form with GPS/photo, availability reply, assignment/access, driver statuses through completion, internal billing, and timeline all worked. The three templates reached `read` with `en` and no send errors. The dispatcher still needs refresh for changes from another device. No templates or sender settings were changed in this test; the permanent sender is still undecided.

Correction history, 13 September: the [sandbox audit](whatsapp-sandbox-phone-audit-2026-09-13.md) records the user's Step 2 completion, the reopened choice of permanent business number, and successful delivery of all three operational templates after changing their language settings from `en_US` to `en`. The new physical phone also passed both availability replies and driver sign-in/job acceptance. The customer template's malformed URL was corrected in place and was **In review** at 12:02 UTC; that blocker was closed by the 14 September test above. The Website URL instructions below have also been corrected.

This is the authoritative restart point for the current WhatsApp work. Read it before changing a Meta template, WhatsApp Business Account, phone number, payment setting, webhook, or Supabase WhatsApp secret.

## Resume safely after the computer restarts

The active repository is `/mnt/ssd4tb/web-apps/Road` on branch `chore/vercel-git-connection`. Start Docker before the local stack, then run:

```bash
cd /mnt/ssd4tb/web-apps/Road
git status --short --branch
npx supabase start
npm run dev
```

Do not run `npx supabase db reset` during a routine restart. The normal restart preserves the local Supabase volumes and HMS address data.

Meta MCP OAuth may ask to authenticate again after Codex restarts. Use the existing `Iceland road assistance` app, App ID `1403947388469576`; do not create another app.

## Decisions confirmed today

- Vegstoð is integrating WhatsApp Cloud API for one towing company and its own number. This is a direct business integration.
- Do not use **Embedded Signup Builder**. That flow is for a platform or provider onboarding other businesses and is not part of this implementation.
- Coexistence and Independent Tech Provider onboarding are also outside the selected route. The company does not need to keep using the WhatsApp Business phone app after the final Cloud API cutover.
- Customers will continue to call the ordinary cellular number `+354 853 7704`. The dispatcher enters the caller's number into Vegstoð, and Vegstoð sends the secure customer and driver links through Cloud API.
- The company owner can add the WhatsApp payment method and complete business verification from Meta Business Settings without developer-app access. Developer access remains necessary for the app, webhooks, templates, and API configuration.
- Use `Atlantic/Reykjavik` / `UTC+00:00` when Meta asks for the time zone.

## Meta assets that must remain distinct

| Asset | Identifier | Current role |
| --- | --- | --- |
| Meta developer app | `1403947388469576` | Existing `Iceland road assistance` app used by Vegstoð |
| Sandbox WABA | `1799725827819599` | Current test Cloud API WABA |
| Sandbox sender | `+1 555-601-6830` | Current test sender |
| Sandbox Phone Number ID | `1251932438011191` | Active Phone Number ID in Supabase until cutover |
| Real company WABA | `931911699982634` | WABA containing the intended company number |
| Real company number | `+354 853 7704` | Intended production sender and normal customer call number |
| Real Phone Number ID | `1209825652224082` | Last read as `ON_PREMISE`, `DISCONNECTED`, and `NOT_VERIFIED` |

The green **Register your WhatsApp phone number** item in the developer-app Step 2 screen proves that the current setup has a registered number. It does not by itself prove that `+354 853 7704` is the active Cloud API sender.

When adding billing, confirm which WABA the payment screen names. The Meta Business Settings screenshot at 09:01 had **Test WhatsApp Business Account** selected. A payment method shown only on the sandbox WABA is not evidence that the real company WABA is ready for production billing.

## Step 2 and Step 3 status observed today

The Meta for Developers **Connect on WhatsApp → Step 2. Production setup** screen at 08:59 showed:

| Item | Screen state |
| --- | --- |
| Configure Webhooks | Complete |
| Register your WhatsApp phone number | Complete for the current setup |
| Add payment to send business-initiated messages | **Not complete** |
| Send message | Complete |

Therefore payment is the only unchecked item in Step 2. **Step 3. Business verification** is a separate unfinished step and showed **Get started**. The Meta Business Settings WABA summary also showed **No payment method found** and business verification **In progress / Start verification**.

The owner can open the intended WABA in Meta Business Settings and use **Payment Settings**. The owner can use **Start verification** for the company's legal verification. The owner must supply the card, legal company information, requested documents, and any SMS/voice verification code; these are not developer tasks.

## Manual operational templates

Meta's plain **English** selection is stored as `en`; **English (US)** is `en_US`. The original handoff confused these languages and caused Meta error `132001`. All three manually created templates use `en` and were shown as **Active – Quality pending**, then delivered successfully on 13 September. The generic `hello_world` test remains `en_US`. [Meta language codes](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/supported-languages/)

All three templates use category **Utility → Default**, numbered variables, no media header, and the standard 10-minute message validity period.

The first API-created versions were wrong. They used the `vegstod_*` names, incorrect branding and incorrect button/sample configuration. The owner deleted them in Meta. They must not be recreated or referenced as active templates:

- `vegstod_customer_intake_v1`
- `vegstod_driver_availability_v1`
- `vegstod_driver_assignment_v1`

The replacement templates are created manually in WhatsApp Manager so every field can be reviewed before submission.

### 1. Customer intake

Brand decision, 26 September: the public app name is **Iceland Road Assistance**, matching the approved Meta template. The earlier 13 September proposal for **Icelandic Road Assistance** was superseded. The body/footer below describe the approved name; no Meta branding edit is needed. Preserve the corrected Dynamic URL base and `en` language. [Meta template management](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-management)

```text
Name: iceland_road_assistance_customer_intake_v1
Language: English (en)
Category: Utility / Default
Header: None

Body:
Iceland Road Assistance has created a secure link for your roadside assistance request. Add your name, location, vehicle details, the assistance needed, a short description, and optional photos. The private link expires in 24 hours. Do not forward it.

Footer:
Iceland Road Assistance

Button type: Visit website
Button text: Open secure request
URL type: Dynamic
Website URL: https://vegstod.vercel.app/customer/
Sample URL: https://vegstod.vercel.app/customer/example-token
```

In WhatsApp Manager's **Dynamic** URL editor, enter only the base URL above. Meta displays and appends `{{1}}` beside the input automatically. Do not type `{{1}}` into that input: this encoded it as the literal `%7B%7B1%7D%7D` before the actual token and broke the customer button. This template has no body variables. Vegstoð sends the raw customer token only as the dynamic URL-button suffix. Only the token hash is retained in PostgreSQL.

The existing customer template, ID `1005863479172773`, was corrected and resubmitted on 13 September. It was **In review** at 12:02 UTC that day. After the user reported approval on 14 September, a freshly delivered button opened the correct customer form and the complete phone submission passed. Already delivered messages from before the correction retain their old URLs.

### 2. Driver availability

```text
Name: iceland_road_assistance_driver_availability_v1
Language: English (en)
Category: Utility / Default
Header: None

Body:
Hello {{1}}, Iceland Road Assistance has a roadside assistance job available. The job is in the {{2}} area and needs {{3}}. The priority is {{4}}, and the approximate distance from your base is {{5}}. Please use a button below to tell us whether you are available.

Footer:
Iceland Road Assistance

Button 1: Custom / Quick Reply — Available
Button 2: Custom / Quick Reply — Unavailable
```

Samples and live parameter order:

| Variable | Sample | Live value from Vegstoð |
| --- | --- | --- |
| `{{1}}` | `Jón Einarsson` | Driver/provider name |
| `{{2}}` | `Akureyri` | Generalized job area with house number removed |
| `{{3}}` | `Dráttur` | Icelandic assistance label or comma-separated labels |
| `{{4}}` | `Venjulegur` | Icelandic priority label |
| `{{5}}` | `12 km` | Approximate distance from the provider base, or `Ekki reiknað` |

The manual form was completed and visually checked. Recheck its review status in WhatsApp Manager after restart.

### 3. Driver assignment and access

```text
Name: iceland_road_assistance_driver_assignment_v1
Language: English (en)
Category: Utility / Default
Header: None

Body:
Hello {{1}}, Iceland Road Assistance has assigned a roadside assistance job to you. The job is in the {{2}} area and needs {{3}}. The priority is {{4}}. Open the secure link below to see the exact location and customer details. The link expires, so do not forward it.

Footer:
Iceland Road Assistance

Button type: Visit website
Button text: Open assigned job
URL type: Dynamic
Website URL: https://vegstod.vercel.app/driver/access?code=
Sample URL: https://vegstod.vercel.app/driver/access?code=example-token
```

Body samples and live parameter order:

| Variable | Sample | Live value from Vegstoð |
| --- | --- | --- |
| `{{1}}` | `Jón Einarsson` | Driver/provider name |
| `{{2}}` | `Akureyri` | Generalized job area with house number removed |
| `{{3}}` | `Dráttur` | Icelandic assistance label or comma-separated labels |
| `{{4}}` | `Venjulegur` | Icelandic priority label |

Meta's Dynamic URL editor appends the URL button's `{{1}}` automatically; enter only the base URL above. This variable is scoped to the button and is separate from body variable `{{1}}`. Vegstoð sends a URL-safe `signup.<token>` or `magiclink.<token>` suffix created from the one-time Supabase Auth link.

The 13 September inspection confirmed that assignment template ID `2115788352358661` already has the correct `Dráttur` sample, `Iceland Road Assistance` footer, and base URL. It remained **Active – Quality pending** and required no edit. A fresh message on the new phone opened driver access, signed in the temporary driver, displayed its assigned job, and successfully saved acceptance at 12:00:47 UTC.

## Supabase configuration changed today

The hosted Supabase template-name secrets now point to the manual replacements:

```text
WHATSAPP_TEMPLATE_CUSTOMER_INTAKE=iceland_road_assistance_customer_intake_v1
WHATSAPP_TEMPLATE_DRIVER_AVAILABILITY=iceland_road_assistance_driver_availability_v1
WHATSAPP_TEMPLATE_DRIVER_ASSIGNMENT=iceland_road_assistance_driver_assignment_v1
```

All three corresponding language secrets were corrected to `en` on 13 September. They were incorrectly set to `en_US` at the original checkpoint:

```text
WHATSAPP_TEMPLATE_CUSTOMER_INTAKE_LANGUAGE=en
WHATSAPP_TEMPLATE_DRIVER_AVAILABILITY_LANGUAGE=en
WHATSAPP_TEMPLATE_DRIVER_ASSIGNMENT_LANGUAGE=en
```

No secret token, app secret, Supabase key, or credential belongs in Git or this handoff.

## Code changes prepared today

- `src/features/whatsapp/messages.ts` now sends Icelandic capability and priority values to the English driver templates. Missing distance is `Ekki reiknað`.
- The related Vitest expectations now cover the Icelandic runtime values.
- The fixed template definitions and `ensure_operational_templates` mutation are removed from `whatsapp-management-v1`. This prevents the deleted API-created templates from being recreated.
- The management function retains only the staff-authorized webhook-subscription action and read-only production-account inspection.
- Customer intake still sends zero body variables plus the customer-token URL suffix.
- Driver availability still sends exactly five body parameters and no URL suffix.
- Driver assignment still sends exactly four body parameters plus the one-time driver URL suffix.

These changes were prepared on top of commit `10a61d8` and saved in the checkpoint commit titled `fix: align WhatsApp templates with manual setup`. Check `git log -1 --oneline` after restart for its exact hash.

## Remaining production cutover work

1. Preserve the three approved `en` templates and corrected URL-button bases; all three passed the 14 September sandbox-phone flow.
2. Have the company owner add the payment method to the WABA that will own the production Cloud API number, and complete Step 3 business verification with the company's real details and documents.
3. Select and verify the permanent company-owned sender. The earlier `+354 853 7704` candidate is not confirmed as the final choice. If reusing a WhatsApp Business phone-app number, export any chats the owner wants to retain before cutover.
4. Register the selected number directly with Cloud API. Connect/subscribe its WABA to the existing app and signed webhook, update the active WABA/Phone Number ID secrets, and run a physical-phone production test through Iceland Road Assistance. Do not use Embedded Signup Builder.
5. Keep the manual `wa.me` fallback until the owner accepts the complete production test.

## Evidence boundary

The generic sandbox Cloud API flow already passed outbound delivery, `sent`/`read` webhook updates, Icelandic availability reply classification, reply correlation, idempotency, and duplicate prevention. The dispatcher UI and fallback paths are deployed at `https://vegstod.vercel.app`.

Production is not complete until payment and business verification are accepted and the selected company-owned number passes the real-sender Cloud API test. The templates and sandbox flow are verified, but the green Step 2 phone-number item and an existing `ON_PREMISE` number record are not substitutes for the final sender evidence.

## Checkpoint verification and deployment

The final local verification passed on 12 September:

- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm test`: 164 tests across 32 Vitest files
- focused WhatsApp tests: 8 tests across 3 files
- `git diff --check`

The revised `whatsapp-management-v1` function was deployed successfully to Supabase project `abpmzqtbllszqqetuubp`. The deployed function no longer accepts `ensure_operational_templates`; deploying it did not send a WhatsApp message or change a Meta asset.
