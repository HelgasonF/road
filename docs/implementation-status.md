# Vegstoð implementation status

Last updated: 6 September 2026

## Maintenance checkpoint

The shutdown/resume state, active repository path, uncommitted work, restart commands, and verification record are captured in [`docs/maintenance-handoff.md`](maintenance-handoff.md). The active repository is `/mnt/ssd4tb/web-apps/Road`; `/mnt/ssd4tb/Road` is not the Git repository. Review `git status --short` before resuming and do not run a database reset during a normal restart.

## Product decisions

- A service provider and driver are the same operational person in the MVP.
- The existing `operators` record remains the source of truth for that person, their phone, availability, base/current location, service radius, capabilities, and vehicles.
- A driver login is an authentication link to an operator; it is not a second driver or company record.
- Dispatch remains manual. Matching suggests suitable operators, but a dispatcher makes the assignment.
- Drivers use a dedicated mobile-first Vegstoð screen for operational job data.
- Drivers never receive operational email and do not need an email address or password. Dispatch generates a private one-time Vegstoð access link and sends it manually to the registered phone through WhatsApp.
- Driver availability contact in the MVP is a normal manual WhatsApp message opened from Vegstoð on a phone or computer. The dispatcher reviews and presses Send, so no paid WhatsApp Business Platform/API automation is required. Calling remains the fallback.
- A customer does not need an account. Dispatch sends a 24-hour, job-specific link directly through a prepared WhatsApp handoff; it collects a confirmed location, vehicle details, problem description, and private photos inside Vegstoð.
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
- Local Iceland address search using the official HMS address register plus Icelandic OpenStreetMap place names, with nearest-address reverse lookup for map pins and a coordinate fallback where no registered address is nearby.
- Direct call and optional WhatsApp actions for registered phone numbers.
- Job-specific manual WhatsApp contact beside every suggested driver: a privacy-safe availability request before assignment and an assignment/login message only after assignment to a driver with active access.
- Real locally created operators and jobs used during testing; demo data is isolated to read-only demo mode.
- One-to-one driver login linked directly to the existing service-provider/operator record.
- Driver-only Row Level Security for the linked operator, vehicles, assignments, jobs, requirements, and history.
- Mobile driver screen with availability, accept/decline, customer contact, an embedded incident map and pin, navigation, vehicle details, and controlled job-status progression.
- Dispatcher-managed passwordless driver links through WhatsApp, visible access status, one-time token use, immediate disable, and re-enable without deleting provider data.
- Dispatcher-created customer intake links with automatic rotation/revocation, a bilingual mobile form, GPS or map-pin confirmation, and one-time submission.
- Direct customer WhatsApp handoff using the registered phone number, clear English instructions, and the newly generated secure link; no copy-and-paste step is required.
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

## Completed WhatsApp driver-access build slice

The passwordless access lifecycle was verified locally in separate dispatcher and clean driver browser sessions:

1. Dispatch selected an unlinked service-provider record and created an access link using only the provider's registered phone number; the interface did not request or display a driver email.
2. The server-only Supabase client created the Auth identity and returned a one-time `signup` token without sending mail. Vegstoð placed its first-party `/driver/access` URL in the prepared WhatsApp message.
3. Opening the URL showed a confirmation page. Pressing **Opna ökumannsskjá** established the restricted Supabase session and landed on `/driver`, where the driver's phone number appeared instead of the internal Auth identifier.
4. A clean browser could open the landing page but could not redeem the already-used token.
5. Generating a later link for an existing driver returned the expected `magiclink` token and opened the same restricted driver screen.
6. Dispatch disabled the driver; refreshing the already-authenticated driver session immediately redirected it to `/login`.
7. All temporary Auth users and operator access changes were removed after verification.

## Completed customer-intake build slice

The account-free intake and private-photo flow was verified locally in three separate access contexts:

1. Dispatch opened the existing Sophie job and generated a random 24-hour customer link. Only its SHA-256 hash was stored in PostgreSQL.
2. Vegstoð prepares the customer's registered WhatsApp chat with clear English instructions and the one-time secure URL; the dispatcher reviews the draft and presses Send. A separate unauthenticated 390 × 844 customer browser opened the link, confirmed the incident map position, added a problem description, and uploaded a real PNG image through a signed upload URL.
3. The customer submitted once and received the bilingual completion screen; the same token could no longer update the job or access the temporary photo route.
4. Dispatch immediately saw the submitted description, intake status, and private thumbnail on Sophie's existing job.
5. Dispatch reassigned that job to Bjarni. His restricted driver screen showed the updated vehicle data, customer description, incident map, and photo.
6. Opening the staff/driver photo endpoint without a session returned HTTP 404. Database tests also prove that a driver sees photo metadata only for their own current assignments and cannot read customer-link hashes.

## Completed driver-contact build slice

The dispatcher-to-driver WhatsApp workflow remains deliberately manual and free of API automation:

1. Every suggested driver now has Call and **Spyrja um framboð** actions directly in the ranked candidate card.
2. The prewritten availability message contains only the driver name, generalized incident area, required assistance, priority, and estimated straight-line distance when known. House numbers and raw map coordinates are suppressed, and the builder receives no customer name, phone, notes, photos, or temporary customer link.
3. After assignment, dispatch can create a second message containing the operational summary and a fresh one-time Vegstoð `/driver/access` URL.
4. Creating that link also creates the linked driver identity when needed. A disabled operator remains blocked until dispatch deliberately re-enables access.
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

## Hosted preview and Free Supabase verification

The first external environment is now connected without upgrading Supabase:

1. The repository is linked to the healthy Supabase Free project `Road` (`abpmzqtbllszqqetuubp`) in `eu-west-1`; all 19 migrations are applied.
2. The hosted database contains 139,346 HMS addresses and 2,970 Icelandic place names, uses about 94 MB, and has an explicitly private `job-photos` bucket.
3. Public/anonymous execution was removed from every application function. Authenticated users cannot invoke trigger-only functions, and customer submission/audit RPCs remain restricted to the server service role. The local pgTAP regression suite and direct hosted catalog assertions verify these boundaries.
4. Vercel Preview has encrypted publishable and server-only Supabase variables with `DEMO_MODE=false`. The stable public test address is `https://vegstod.vercel.app`; the same variables are prepared for Production, but no production deployment is active. The private GitHub repository is connected for automatic feature-branch previews, with `main` reserved as the production branch.
5. Supabase Auth uses that stable address as its Site URL and allows it plus both local development origins as redirects. Email confirmation and TOTP remain enabled, public self-signup is disabled, passwords require at least 10 characters with letters and digits, and external PostgreSQL connections require SSL.
6. A fresh automatic Git Preview completed staff login, HMS address search, provider/vehicle creation, driver invitation and activation, job creation and matching, one-time customer intake with a real private PNG, assignment, driver acceptance and every operational status through completion, both billing legs through full settlement, the unified timeline, driver route isolation, and immediate access revocation. The 390 × 844 customer and driver layouts had no horizontal overflow and the browser reported no application-console errors.
7. Direct hosted assertions confirmed the completed job, submitted intake, private upload, accepted assignment, seven status changes, five billing events, and independent `paid`/`paid` settlement. Every temporary database record, Storage object, and Auth user was deleted afterward; only the real admin plus reference location data remain. The full record is in [`docs/hosted-audit-2026-09-06.md`](hosted-audit-2026-09-06.md).

The hosted audit above used the superseded email-invitation implementation. The replacement passwordless WhatsApp access flow is complete and verified locally; its hosted Preview result is recorded below after migration and deployment. SMTP is not a customer or driver requirement.

## Real Android device verification

A Samsung SM-G990B2 running Android 14 and Chrome 149 completed the real local workflow over USB with ADB reverse forwarding for the Next.js app and Supabase API/Storage:

1. A temporary dispatcher signed in on the phone, created a real local job through HMS address search, and opened the dispatcher, billing, and unified-timeline screens at the device's actual 411 CSS-pixel viewport without horizontal overflow.
2. Next.js initially blocked phone-loaded development chunks with HTTP 403. The server log identified the loopback origin boundary; `allowedDevOrigins: ["127.0.0.1"]` fixed the client chunks and hot-reload connection on the device.
3. The temporary customer link opened in a separate phone tab. Android's native photo picker selected a synthetic test PNG, the bilingual form submitted the confirmed map location and vehicle details, and private Storage plus database metadata both contained the completed upload.
4. Customer and driver call links opened Samsung's dialer with the correct number but no call was placed. This phone did not have WhatsApp installed, so the WhatsApp links opened the official browser fallback with the intended recipient and prepared-message destination.
5. Opening the driver's WhatsApp availability draft and phone link produced separate audited `whatsapp` and `phone` contact events. The timeline described them only as links/drafts opened and did not claim a sent message or connected call.
6. The job was assigned from the phone to a temporary driver login. The driver signed in, accepted it, saw the exact customer pin and navigation action, customer contact details, vehicle and incident notes, and the authorized private photo, then advanced the job to `en_route`.
7. The synthetic job, photo object, phone file, temporary accounts, assignment, links, and audit events were removed afterward. Verification confirmed no temporary records or storage object remained and the existing operator was unlinked from the temporary login.

This proves the complete local Android behavior on physical hardware. The application and Supabase services are now externally reachable over HTTPS, but the public preview still needs a physical-phone pass without USB forwarding.

## Full verification snapshot

The complete current working tree was rechecked on 6 September 2026:

- `npm run build` passed with all application routes, including dispatcher, staff billing, the staff job timeline, customer intake, private photo delivery, passwordless driver-link confirmation, and the driver screen.
- `npm run typecheck` and `npm run lint` passed without errors.
- `npm test` passed all 124 tests across 24 Vitest files, including customer and driver WhatsApp handoffs, one-time driver-link validation, and international-number routing.
- `npx supabase test db` passed all 176 assertions across seven pgTAP files, covering the dispatch schema, indexed HMS reverse geocoding, driver isolation/access management, customer-link lifecycle and first opening, private-photo authorization, contact-event audit isolation, billing handoff, financial transitions, value locking, audited-only mutation privileges, function execution grants, and driver financial isolation.
- `npx supabase db lint --local --schema public` reported no application-schema errors. A whole-database lint also reports known analyzer findings inside Supabase's installed PostGIS extension functions; these are vendor extension code rather than Vegstoð migrations.
- `npm audit --omit=dev` reported zero production dependency vulnerabilities.
- `git diff --check` passed, and the repository scan found no committed Mapbox token, Supabase secret, placeholder TODO/FIXME, or accidental application debug logging. The importer intentionally prints its completed import summary when run from the terminal.

The existing browser verification remains valid for the critical dispatcher → customer → driver path, including an unauthenticated phone-sized customer session, a real private image upload, one-time customer-link consumption, reassignment, driver-only visibility, and rejection of an anonymous private-photo request. A fresh hosted pass on 6 September exercised the automatic Git Preview through provider and vehicle creation, the former driver-invitation path, customer intake, assignment, every driver status through completion, five financial audit actions through full settlement, timeline aggregation, access revocation, and complete cleanup; see [`docs/hosted-audit-2026-09-06.md`](hosted-audit-2026-09-06.md). The physical Android pass additionally covered native photo selection, dialer and WhatsApp browser handoffs, dispatcher assignment, driver acceptance, exact map rendering, authorized photo delivery, and progression to `en_route`. A later local pass verified new-driver and returning-driver WhatsApp Auth links, explicit confirmation, one-time use, phone-only presentation, and immediate revocation. The application produced no application-console errors after the development-origin fix; headless Chromium emitted only its known WebGL software-rendering performance warnings while drawing MapLibre, while the Android map cancelled superseded OpenStreetMap tile requests during normal redraws.

## Current readiness boundary

The implemented flows are complete locally, and the complete dispatcher → customer → driver → billing path has passed against an automatic Vercel Preview and the hosted Supabase Free project. The product is still not declared production-ready: a physical phone must repeat the public HTTPS workflow with the passwordless driver link, and the operational launch checklist must be approved. The current link is a preview environment rather than a production release.

## Next slices

1. Repeat the customer → dispatch → driver workflow on a physical phone through the public HTTPS preview, including the native picker and private-photo display, without USB forwarding.
2. Confirm new-driver link creation, one-time redemption, returning-driver access, and immediate disable through the public HTTPS preview.
3. Promote a reviewed build to production only after the phone and launch checks pass; upgrade the same Supabase project later when capacity, uptime, backup, or support requirements justify it.
4. Select and integrate Iceland-compatible accounting/invoicing and payment providers only after an accountant confirms the invoice, VAT, refund, credit-note, provider-payment, and reconciliation requirements. Customer payment links will be delivered through the existing WhatsApp handoff.

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
