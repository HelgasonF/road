# Hosted WhatsApp end-to-end audit — 14 September 2026

User authorization: all templates were approved; test the system end to end.

The hosted customer → dispatcher → driver → completed job → internal billing path **passed** on 14 September, approximately 20:38–20:58 UTC. This closes the customer-button blocker from the [13 September audit](whatsapp-sandbox-phone-audit-2026-09-13.md).

**Visual correction, later on 14 September:** the user spotted an OpenStreetMap error in the customer form. It was reproduced as an **Access blocked** PNG returned with HTTP 200; the operational test above did not prove that the customer basemap rendered correctly. The cause, narrowly scoped fix, real-image/header verification, and phone check are recorded in the [customer map follow-up](customer-map-error-2026-09-14.md). GPS submission and the persisted operational/billing results above remain valid.

## Environment and scope

- Hosted application: `https://vegstod.vercel.app`, connected to Supabase project `abpmzqtbllszqqetuubp`.
- Sandbox sender: `+1 555-601-6830`; sole recipient: the user's authorized test phone, `+354 659 7003`.
- Physical Samsung SM-G990B2, WhatsApp and its default Firefox browser; dispatcher and billing exercised through a separate authenticated desktop browser.
- One disposable provider, one customer request, one generated test image, one assignment, and one temporary driver identity. Existing demonstration/customer records were not used as fixtures.
- Customer actions used the actual WhatsApp template button and phone form. Availability, assignment, driver login, and operational transitions used their normal interfaces. API access was used for fixture setup, independent verification, and cleanup.
- The temporary provider's base was moved to the submitted GPS point so that only this fixture was selected for a nearby match. No other provider received a message.

## Verified sequence

1. **Create and send:** dispatcher **Nýtt verkefni → Búa til og senda WhatsApp** created a phone-only pending request and a 24-hour secure link. Before submission, assignment remained unavailable.
2. **Customer link:** **Open secure request** in WhatsApp opened the actual hosted form. The corrected template URL worked without modifying, reconstructing, or manually replacing the delivered URL.
3. **Customer form:** submitted `Test 14 September`, registration `TEST14`, brand `Ford`, one person, GPS location, towing, and an explicitly marked test description. Granted the phone browser's location permission and used its GPS result. Selected the generated image through Android's photo picker; upload completed and the thumbnail appeared.
4. **Customer confirmation:** the phone displayed **Thank you — details received** and the Icelandic confirmation. The page used **Icelandic Road Assistance**. Database verification confirmed the submitted fields, `location_source = gps`, the finalized photo, a submission timestamp, and `intake_pending = false`.
5. **Dispatch handoff:** after refreshing the desktop page, the customer data, map location, towing requirement, and private photo appeared. The test provider ranked as suitable at 0 km.
6. **Availability:** dispatch sent the availability template to that provider. Pressing **Available** on the phone produced a signed inbound reply correlated to the exact message, job, and provider. Dispatch showed **Svaraði laus** after refresh. This reply did not itself assign the job.
7. **Assignment and access:** dispatch assigned the same provider and used **Búa til og senda** to generate and send the one-time driver link. The actual **Open assigned job** button opened the confirmation page; **Opna ökumannsskjá** signed the driver in without a password.
8. **Driver data:** the phone displayed the customer's location/map, contact, Ford/TEST14, person count, towing request, description, and the uploaded test photo.
9. **Driver operations:** the driver accepted, departed, arrived, started work, recorded transport, and completed the job through phone buttons. Every transition persisted with the temporary driver's identity as actor.
10. **Billing:** completion opened the provider billing workflow. Through the staff UI, saved test payer/provider amounts of 2,000/1,500 ISK, recorded fake invoice references `E2E-ONLY-20260914-PAYER` and `E2E-ONLY-20260914-PROVIDER`, and exercised both payment-recording confirmations. Both internal statuses reached `paid`, survived reload, and locked the finalized amounts. These were disposable bookkeeping test records; no invoice was sent and no money moved.
11. **Timeline:** the completed job's unified timeline showed 30 events spanning creation, WhatsApp sends/reads, link opening, photo upload, customer submission, availability reply, assignment, acceptance, all operational transitions, and five billing events.
12. **One-time access:** logged out on the phone, reopened the same assignment message, and pressed the access confirmation again. The application rejected the used link with **Aðgangstengillinn er útrunninn eða hefur þegar verið notaður.**

## Delivery and persisted status evidence

| Template purpose | Language | Created, UTC | Final ledger state | Attempts | Send error |
| --- | --- | --- | --- | --- | --- |
| Customer intake | `en` | 20:39:49 | `read` | 1 | None |
| Driver availability | `en` | 20:49:01 | `read` | 1 | None |
| Driver assignment/access | `en` | 20:51:37 | `read` | 1 | None |

All three retain the existing `iceland_road_assistance_*_v1` template names. Signed webhook records contained `sent` and `read` receipts; delivery was also physically observed on the phone. The correlated **Available** reply arrived at 20:49:40 UTC. Customer submission was recorded at 20:48:02 UTC.

| Persisted transition | UTC |
| --- | --- |
| `new → assigned` | 20:50:55 |
| `assigned → accepted` | 20:53:56 |
| `accepted → en_route` | 20:54:36 |
| `en_route → on_scene` | 20:54:56 |
| `on_scene → in_progress` | 20:55:14 |
| `in_progress → transporting` | 20:55:30 |
| `transporting → completed` | 20:55:48 |

The first transition belongs to staff; the remaining six belong to the driver. Both internal payment records were completed at 20:57 UTC.

## Observations and boundaries

- **Refresh is currently required for changes made elsewhere.** The open dispatcher screen did not automatically pick up the customer's phone submission. Refresh correctly loaded it; subsequent reply/status checks also used fresh navigation or reload. The dispatcher component currently has no subscription or polling loop. This audit proves the workflow with refresh, not live automatic updates between devices.
- WhatsApp temporarily left the assignment link button disabled after the first tap. Reopening the chat allowed the same delivered button to open normally. No message resend or link modification was needed.
- Customer pages use **Icelandic Road Assistance**. Approved Meta message bodies use **Iceland Road Assistance**; the deployed staff/driver screens still contain the Vegstoð working name. Broader local branding edits were preserved and were not deployed during this audit.
- The desktop browser recorded no console errors. Four WebGL `ReadPixels` GPU performance warnings appeared during map rendering. Native phone screens and persisted results were inspected; this was not a phone-console instrumentation run.
- This is a successful **sandbox** test. Selecting/registering the permanent business sender and verifying its billing/cutover remain separate work. No Meta template, account, phone registration, secret, or deployment was changed.
- No application source changed for this audit, so build/unit suites were not rerun. The validation was the hosted workflow and independent database/webhook evidence.

## Evidence and cleanup

Evidence and exact disposable identifiers are retained outside Git in `~/.config/vegstod/whatsapp-e2e-2026-09-14/manifest.json`. It contains no passwords, API keys, or access URLs; it does contain the private test GPS point. Screenshots are saved in the ignored `output/playwright/` directory.

Cleanup completed at approximately 21:01–21:03 UTC:

- Logged out the driver, verified rejection of its used link, disabled its access, and deleted its temporary Auth identity and profile.
- Removed the generated image from private Storage and the phone's Downloads directory.
- A guarded transaction checked the exact fixture UUIDs, customer/provider labels, completed status, accepted assignment, photo ID, three read messages, seven status transitions, and test invoice references before deletion.
- Follow-up counts were zero for the test job, links, photos, billing, billing events, assignments, status history, provider, profile, outbound messages, and correlated inbound reply. Storage contained zero objects for the test job.
- Preserved other application records, the existing generic WhatsApp test evidence, raw signed webhook envelopes, and the recipient's `allowed` preference with its original source reply.
- Closed the test desktop browser, logged out the audit staff session, and removed its temporary credential/cookie files. The phone driver session remains logged out. Private IDs and result evidence remain in the manifest; reusable bearer URLs were not stored there.
- `git diff --check` passed. Existing source changes from other work were preserved.
