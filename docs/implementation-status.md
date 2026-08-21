# Vegstoð implementation status

Last updated: 21 August 2026

## Product decisions

- A service provider and driver are the same operational person in the MVP.
- The existing `operators` record remains the source of truth for that person, their phone, availability, base/current location, service radius, capabilities, and vehicles.
- A driver login is an authentication link to an operator; it is not a second driver or company record.
- Dispatch remains manual. Matching suggests suitable operators, but a dispatcher makes the assignment.
- Drivers use a dedicated mobile-first Vegstoð screen for operational job data.
- Driver availability contact in the MVP is a normal manual WhatsApp message opened from Vegstoð on a phone or computer. The dispatcher reviews and presses Send, so no paid WhatsApp Business Platform/API automation is required. Calling remains the fallback.
- A customer does not need an account. A 24-hour, job-specific link collects a confirmed location, vehicle details, problem description, and private photos.
- Every payer pays Vegstoð. Vegstoð is the payer-facing seller in the system and separately settles with the assigned service provider; the provider never invoices the customer through this workflow.
- Billing stays in a separate staff-only **Uppgjör** workspace so the dispatcher map remains operational. Drivers cannot see payer prices, provider totals, or Vegstoð's gross difference.
- Each job has a separate staff-only unified timeline. It shows verified system facts and labels external WhatsApp/phone actions only as links or drafts opened, never as a confirmed send or connected call.

## Completed

- Next.js dispatcher interface with Supabase authentication and staff-only access.
- Operator creation and editing using an address or map pin rather than coordinates alone.
- Vehicle and capability management.
- Job creation, editing, manual assignment, reassignment history, and operational statuses.
- PostGIS distance and service-radius matching with manual dispatcher control.
- MapLibre map with Iceland-correct markers and service-radius overlays.
- Local Iceland address search using the official HMS address register plus Icelandic OpenStreetMap place names.
- Direct call and optional WhatsApp actions for registered phone numbers.
- Job-specific manual WhatsApp contact beside every suggested driver: a privacy-safe availability request before assignment and an assignment/login message only after assignment to a driver with active access.
- Real locally created operators and jobs used during testing; demo data is isolated to read-only demo mode.
- One-to-one driver login linked directly to the existing service-provider/operator record.
- Driver-only Row Level Security for the linked operator, vehicles, assignments, jobs, requirements, and history.
- Mobile driver screen with availability, accept/decline, customer contact, an embedded incident map and pin, navigation, vehicle details, and controlled job-status progression.
- Dispatcher-managed driver invitations, password setup and recovery, visible access status, immediate disable, and re-enable without deleting provider data.
- Dispatcher-created customer intake links with automatic rotation/revocation, a bilingual mobile form, GPS or map-pin confirmation, and one-time submission.
- Private job-photo upload to Supabase Storage, with access limited to staff, the currently assigned driver, and the active temporary customer link.
- Separate staff billing workspace with payer queues, provider settlement, invoice/payment states, locked finalized amounts, financial audit history, and deep links to the operational job.
- Staff-only unified job timeline with category filters, customer-link first-open tracking, audited driver contact attempts, assignment/status history, photo metadata, and billing events.

## Completed driver build slice

The driver slice was verified locally with separate dispatcher and driver accounts:

1. Dispatcher assigned an existing real job to Anna and selected her vehicle.
2. Anna signed in and saw only her two current assignments rather than all four jobs.
3. Anna accepted the new assignment and changed it to `en_route` from the driver screen.
4. The dispatcher signed back in and saw the updated `en_route` status on the same job.
5. Direct navigation from a driver session to the dispatcher route redirected back to `/driver`.
6. The responsive driver interface was inspected at a 390 × 844 phone viewport with no browser-console errors.

## Completed driver-access build slice

The access lifecycle was verified locally in separate dispatcher and driver browser sessions:

1. Dispatch selected the existing Bjarni service-provider record and sent an invitation to `bjarni.driver@vegstod.local`.
2. The Icelandic Supabase invitation arrived in local Mailpit and linked to Vegstoð's password-setup screen.
3. Bjarni chose his own password and landed on a driver screen containing only Bjarni's operational data.
4. Dispatch sent a separate Icelandic password-recovery email.
5. Dispatch disabled Bjarni's login; refreshing his already-authenticated driver session immediately redirected it to `/login`.
6. Dispatch re-enabled the same account and the existing session regained `/driver` without recreating Bjarni, his vehicle, or any history.

## Completed customer-intake build slice

The account-free intake and private-photo flow was verified locally in three separate access contexts:

1. Dispatch opened the existing Sophie job and generated a random 24-hour customer link. Only its SHA-256 hash was stored in PostgreSQL.
2. A separate unauthenticated 390 × 844 customer browser opened the link, confirmed the incident map position, added a problem description, and uploaded a real PNG image through a signed upload URL.
3. The customer submitted once and received the bilingual completion screen; the same token could no longer update the job or access the temporary photo route.
4. Dispatch immediately saw the submitted description, intake status, and private thumbnail on Sophie's existing job.
5. Dispatch reassigned that job to Bjarni. His restricted driver screen showed the updated vehicle data, customer description, incident map, and photo.
6. Opening the staff/driver photo endpoint without a session returned HTTP 404. Database tests also prove that a driver sees photo metadata only for their own current assignments and cannot read customer-link hashes.

## Completed driver-contact build slice

The dispatcher-to-driver WhatsApp workflow remains deliberately manual and free of API automation:

1. Every suggested driver now has Call and **Spyrja um framboð** actions directly in the ranked candidate card.
2. The prewritten availability message contains only the driver name, generalized incident area, required assistance, priority, and estimated straight-line distance when known. House numbers and raw map coordinates are suppressed, and the builder receives no customer name, phone, notes, photos, or temporary customer link.
3. After assignment, dispatch can send a second message containing the operational summary and the absolute Vegstoð `/driver` login URL.
4. The login-link action appears only when the assigned operator has active driver access. Invited, disabled, and unlinked states explain what dispatch must resolve first.
5. Both actions open ordinary WhatsApp/WhatsApp Web; Vegstoð never sends automatically and the dispatcher remains responsible for reviewing and pressing Send.
6. Unit/component tests verify Icelandic and international WhatsApp addressing, exact message content, missing-distance behavior, active-access gating, and runtime construction of the driver URL. A 1440 px and 390 px Playwright pass confirmed both dispatcher states, the WhatsApp handoff, no horizontal overflow, and no application-console errors.

## Completed billing and settlement build slice

The financial workflow is connected to the operational job without adding billing forms to the dispatcher map:

1. Every existing and new job has exactly one `job_billing` record. All jobs appear in `/billing`, with queues for missing information, active work, ready to invoice, awaiting payer payment, provider payment, settlement, disputes, refunds, and voids.
2. Staff records the payer type, legal/billing identity, authorization and reference values, service summary, payer total, provider total, and internal notes. The four payer types are customer, rental company, insurer/assistance company, and business/fleet account.
3. Completion automatically changes a complete payer draft to `ready_to_invoice` and an assigned provider side to `awaiting_provider_invoice`. Missing payer data remains explicitly missing rather than being silently considered ready.
4. Payer → Vegstoð and Vegstoð → provider use independent state machines. Invoice issuance, incoming payment, provider-invoice approval, outgoing payment, overdue state, disputes, reopenings, refunds, and cancelled-job voids use guarded database transitions.
5. A case is `Fulluppgert` only when both sides are paid. Receiving payer money does not mark the provider paid, and paying the provider does not mark the payer paid.
6. Every detail save and financial transition creates a staff audit event. Drivers have no RLS access to either billing records or events. Payer values lock after invoice issuance and the provider total locks after approval at both the UI and database boundaries; notes remain editable and audited.
7. Real browser tests covered active draft entry, search and queues, dispatcher completion and deep links, payer and provider invoices, overdue handling, both dispute/reopen paths, independent payment confirmations, full settlement, refund confirmation and its separate queue, cancelled-job void confirmation, immutable field locks, editable internal notes, and the audit history. The 1440 px and 390 × 844 layouts had no application-console errors or page-level horizontal overflow.

This slice records and controls the workflow only. It does not yet create a legal invoice, charge a card, move bank funds, file VAT, or synchronize an accounting platform. Those external actions remain manual and must not be inferred from a recorded status.

## Completed unified job timeline build slice

The timeline is connected to the existing operational and financial records without duplicating their source of truth:

1. Every job detail has a **Skoða feril verkefnis** link to `/jobs/[jobId]/history`; the page links back to the selected dispatcher job and its billing case.
2. The newest-first list merges job creation/status changes, customer-link creation/first opening/revocation/submission, completed photo uploads, assignment/acceptance/decline/reassignment, staff driver-contact attempts, and billing audit events.
3. Repeated status rows generated by assignment acceptance or decline are suppressed when the assignment lifecycle already represents the same event. Filters isolate job, customer, service-provider, and billing events.
4. Opening a normal WhatsApp draft or `tel:` link is persisted through a staff-only audited RPC. The UI explicitly says Vegstoð cannot verify that an external message was sent or a call connected.
5. `customer_intake_links.first_opened_at` records the first real customer-page visit. The raw token remains unavailable to the timeline and all staff/driver data stays outside the public customer page.
6. Drivers cannot read `job_contact_events`, billing events, or the staff timeline route. Direct authenticated inserts into contact history are blocked; only the validated staff RPC can write an event.
7. Browser verification created and opened a real customer link, opened a real WhatsApp handoff, confirmed both events in the timeline, filtered a settled job to its six billing events, and confirmed driver-role denial. Desktop and 390 × 844 layouts had no application-console errors or horizontal overflow. Temporary link/contact records were removed afterward and the test account was disabled again.

## Full verification snapshot

The complete current working tree was rechecked on 21 August 2026:

- `npm run build` passed with all application routes, including dispatcher, staff billing, the staff job timeline, customer intake, private photo delivery, authentication confirmation/password setup, and the driver screen.
- `npm run typecheck` and `npm run lint` passed without errors.
- `npm test` passed all 120 tests across 20 Vitest files.
- `npx supabase test db` passed all 165 assertions across six pgTAP files, covering the dispatch schema, driver isolation/access management, customer-link lifecycle and first opening, private-photo authorization, contact-event audit isolation, billing handoff, financial transitions, value locking, audited-only mutation privileges, and driver financial isolation.
- `npx supabase db lint --local --schema public` reported no application-schema errors. A whole-database lint also reports known analyzer findings inside Supabase's installed PostGIS extension functions; these are vendor extension code rather than Vegstoð migrations.
- `npm audit --omit=dev` reported zero production dependency vulnerabilities.
- `git diff --check` passed, and the repository scan found no committed Mapbox token, Supabase secret, placeholder TODO/FIXME, or accidental application debug logging. The importer intentionally prints its completed import summary when run from the terminal.

The existing browser verification remains valid for the critical dispatcher → customer → driver path, including an unauthenticated phone-sized customer session, a real private image upload, one-time link consumption, reassignment, driver-only visibility, and rejection of an anonymous private-photo request. A fresh Playwright smoke pass also confirmed that Bjarni can still sign in, sees only his assigned job with the correct Iceland map pin, customer call/WhatsApp actions, submitted notes and authorized private photo, and is redirected from `/` back to `/driver`. A separate anonymous 390 × 844 session received the safe unavailable state for an invalid customer link, and an anonymous private-photo request still returned HTTP 404. The billing browser pass covered the complete operational-to-financial handoff and independent settlement. The timeline pass covered live customer-link opening, WhatsApp handoff audit, operational/assignment history, billing filtering, driver denial, deterministic Iceland timestamps, and desktop/mobile rendering. The application produced no browser-console errors; headless Chromium emitted only its known WebGL software-rendering performance warnings while drawing MapLibre.

## Current readiness boundary

The implemented flows are complete and verified locally, but the product is not yet declared production-ready. Customer links currently use the local application origin, and browser uploads use the configured Supabase URL. A real customer phone therefore needs both the Vegstoð app and the Supabase API/Storage endpoint to be securely reachable; exposing only the Next.js page through a tunnel is not enough. No customer should receive a `localhost` link.

## Next slices

1. Create a secure phone-test environment in which both the app and Supabase API/Storage are reachable, then test the complete dispatcher → customer → driver flow on iPhone and Android.
2. Connect hosted Supabase and production email only after the real-phone workflow is approved.
3. Select and integrate Iceland-compatible accounting/invoicing and payment providers only after an accountant confirms the invoice, VAT, refund, credit-note, provider-payment, and reconciliation requirements.

## Intended end-to-end workflow

```text
Customer calls dispatcher
        -> dispatcher creates the job
        -> dispatcher optionally sends a secure customer link
        -> customer confirms location and uploads photos
        -> dispatcher assigns one operator/driver and vehicle
        -> driver accepts in the Vegstoð driver screen
        -> driver calls/navigates and updates job status
        -> dispatcher follows the same job through completion
        -> completed job becomes ready in Uppgjör
        -> Vegstoð invoices and collects from the payer
        -> Vegstoð approves and pays the provider separately
        -> both paid legs mark the case fully settled
```

## Deferred deliberately

- Automated push notifications and SMS escalation.
- Automatic dispatch.
- Continuous background driver tracking.
- Native iOS/Android applications.
- WhatsApp Business automation.
- Automated legal invoice/accounting synchronization, online payment collection, refunds/credit notes, and bank payouts.
- Rental-company and insurer account integrations beyond manual payer/reference capture.
