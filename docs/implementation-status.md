# Vegstoð implementation status

Last updated: 7 September 2026

## Maintenance checkpoint

The shutdown/resume state, active repository path, uncommitted work, restart commands, and verification record are captured in [`docs/maintenance-handoff.md`](maintenance-handoff.md). The active repository is `/mnt/ssd4tb/web-apps/Road`; `/mnt/ssd4tb/Road` is not the Git repository. Review `git status --short` before resuming and do not run a database reset during a normal restart.

## Product decisions

- A service provider and driver are the same operational person in the MVP.
- The existing `operators` record remains the source of truth for that person, their phone, availability, base/current location, service radius, capabilities, and vehicles.
- A driver login is an authentication link to an operator; it is not a second driver or company record.
- Dispatch remains manual. Matching suggests suitable operators, but a dispatcher makes the assignment.
- Drivers use a dedicated mobile-first Vegstoð screen for operational job data.
- Drivers never receive operational email and do not need an email address or password. Dispatch generates a private one-time Vegstoð access link and delivers it to the registered phone through WhatsApp.
- The tested MVP uses normal manual WhatsApp messages opened from Vegstoð on a phone or computer. The dispatcher reviews and presses Send. The official Meta WhatsApp Cloud API is now the planned production delivery channel; the existing manual `wa.me` handoff and calling remain operational fallbacks.
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
5. `customer_intake_links.first_opened_at` records the first request that reaches the customer page. A live WhatsApp test proved that link-preview retrieval can set it before a person opens the form, so `submitted_at` remains the authoritative completion signal. The raw token remains unavailable to the timeline and all staff/driver data stays outside the public customer page.
6. Drivers cannot read `job_contact_events`, billing events, or the staff timeline route. Direct authenticated inserts into contact history are blocked; only the validated staff RPC can write an event.
7. Browser verification created and opened a real customer link, opened a real WhatsApp handoff, confirmed both events in the timeline, filtered a settled job to its six billing events, and confirmed driver-role denial. Desktop and 390 × 844 layouts had no application-console errors or horizontal overflow. Temporary link/contact records were removed afterward and the test account was disabled again.

## Hosted preview and Free Supabase verification

The first external environment is now connected without upgrading Supabase:

1. The repository is linked to the healthy Supabase Free project `Road` (`abpmzqtbllszqqetuubp`) in `eu-west-1`; all 20 migrations are applied.
2. The hosted database contains 139,346 HMS addresses and 2,970 Icelandic place names, uses about 94 MB, and has an explicitly private `job-photos` bucket.
3. Public/anonymous execution was removed from every application function. Authenticated users cannot invoke trigger-only functions, and customer submission/audit RPCs remain restricted to the server service role. The local pgTAP regression suite and direct hosted catalog assertions verify these boundaries.
4. Vercel Preview has encrypted publishable and server-only Supabase variables with `DEMO_MODE=false`. The stable public test address is `https://vegstod.vercel.app`; the same variables are prepared for Production, but no production deployment is active. The private GitHub repository is connected for automatic feature-branch previews, with `main` reserved as the production branch.
5. Supabase Auth uses that stable address as its Site URL and allows it plus both local development origins as redirects. Email confirmation and TOTP remain enabled, public self-signup is disabled, passwords require at least 10 characters with letters and digits, and external PostgreSQL connections require SSL.
6. A fresh automatic Git Preview completed staff login, HMS address search, provider/vehicle creation, driver invitation and activation, job creation and matching, one-time customer intake with a real private PNG, assignment, driver acceptance and every operational status through completion, both billing legs through full settlement, the unified timeline, driver route isolation, and immediate access revocation. The 390 × 844 customer and driver layouts had no horizontal overflow and the browser reported no application-console errors.
7. Direct hosted assertions confirmed the completed job, submitted intake, private upload, accepted assignment, seven status changes, five billing events, and independent `paid`/`paid` settlement. Every temporary database record, Storage object, and Auth user was deleted afterward; only the real admin plus reference location data remain. The full record is in [`docs/hosted-audit-2026-09-06.md`](hosted-audit-2026-09-06.md).
8. Commit `ba61a50` then passed the replacement WhatsApp driver-access flow on the automatic Vercel Preview: new-driver `signup`, explicit confirmation, one-time reuse rejection, returning-driver `magiclink`, immediate disable, job creation and assignment, prepared assignment handoff, audited contact opening, phone-sized assigned-job visibility, driver acceptance, direct Supabase persistence checks, and complete cleanup. See [`docs/hosted-whatsapp-driver-audit-2026-09-06.md`](hosted-whatsapp-driver-audit-2026-09-06.md).
9. On 7 September, Alli completed a real stakeholder demonstration through WhatsApp: customer intake with a map pin, vehicle details, note, and two private JPEGs; dispatcher matching and assignment; passwordless driver activation; and driver acceptance. The accepted record remains available for owner inspection. See [`docs/alli-live-demo-2026-09-07.md`](alli-live-demo-2026-09-07.md).

The original full audit used the superseded email-invitation implementation. The separate follow-up audit proves the replacement passwordless WhatsApp path on the current hosted revision. SMTP is not a customer or driver requirement.

## Real Android device verification

A Samsung SM-G990B2 running Android 14 and Chrome 149 completed the real local workflow over USB with ADB reverse forwarding for the Next.js app and Supabase API/Storage:

1. A temporary dispatcher signed in on the phone, created a real local job through HMS address search, and opened the dispatcher, billing, and unified-timeline screens at the device's actual 411 CSS-pixel viewport without horizontal overflow.
2. Next.js initially blocked phone-loaded development chunks with HTTP 403. The server log identified the loopback origin boundary; `allowedDevOrigins: ["127.0.0.1"]` fixed the client chunks and hot-reload connection on the device.
3. The temporary customer link opened in a separate phone tab. Android's native photo picker selected a synthetic test PNG, the bilingual form submitted the confirmed map location and vehicle details, and private Storage plus database metadata both contained the completed upload.
4. Customer and driver call links opened Samsung's dialer with the correct number but no call was placed. This phone did not have WhatsApp installed, so the WhatsApp links opened the official browser fallback with the intended recipient and prepared-message destination.
5. Opening the driver's WhatsApp availability draft and phone link produced separate audited `whatsapp` and `phone` contact events. The timeline described them only as links/drafts opened and did not claim a sent message or connected call.
6. The job was assigned from the phone to a temporary driver login. The driver signed in, accepted it, saw the exact customer pin and navigation action, customer contact details, vehicle and incident notes, and the authorized private photo, then advanced the job to `en_route`.
7. The synthetic job, photo object, phone file, temporary accounts, assignment, links, and audit events were removed afterward. Verification confirmed no temporary records or storage object remained and the existing operator was unlinked from the temporary login.

This proves the complete local Android behavior on physical hardware. A later pass also completed the real public HTTPS and installed-WhatsApp workflow described below.

## Public HTTPS physical-phone verification

A physical phone with WhatsApp installed completed the live Preview workflow without USB forwarding:

1. Dispatch created the secure customer link in Vegstoð, opened its prepared WhatsApp handoff in a linked WhatsApp Web session, and manually pressed Send. WhatsApp showed two blue checks.
2. The phone opened the public link, used GPS, uploaded a real 2,308,115-byte image through the native picker, and submitted the customer form. Hosted Supabase confirmed the opened/submitted timestamps, `gps` location source, photo metadata, and private Storage object.
3. Dispatch assigned the job, generated its passwordless driver link from the assignment, opened the prepared WhatsApp message, and manually pressed Send. The staff-only contact event recorded the assignment handoff.
4. The phone redeemed the one-time link, displayed the private customer image, accepted the assignment, and advanced through every driver status to completion. Supabase recorded all seven transitions and returned the provider to `available`.
5. The completed job produced 13 staff timeline events and the expected billing handoff in `missing_information`/`awaiting_provider_invoice`.
6. The detailed status path felt too long in real use. **Ljúka verkefni** is now the primary action at the scene, while work-in-progress and transport tracking remain optional.

The disposable provider, job, Auth user, photo, and billing case remain temporarily available for the owner to inspect from the staff interface. See [`docs/public-phone-audit-2026-09-06.md`](public-phone-audit-2026-09-06.md).

## Hosted presentation network

Five clearly marked presentation providers are stored in the hosted Supabase project for the owner's system demonstration:

| Driver | Company | Base | Radius | Vehicles |
| --- | --- | --- | ---: | ---: |
| Anna S. Jónsdóttir | Norðurhjálp · SÝNISHORN | Akureyri | 225 km | 2 |
| Bjarni Ólafsson | Vestfjarðabjörgun · SÝNISHORN | Ísafjörður | 240 km | 2 |
| Elín Guðmundsdóttir | Austurdráttur · SÝNISHORN | Egilsstaðir | 240 km | 2 |
| Jón Einarsson | Suðurlandsaðstoð · SÝNISHORN | Hvolsvöllur | 230 km | 2 |
| Katrín Magnúsdóttir | Borgarhjálp · SÝNISHORN | Reykjavík | 190 km | 2 |

All five are active and available. Each provider has all eleven matching capabilities plus one service van and one recovery vehicle whose capabilities divide the general-assistance and recovery work. The four regional dummy phone numbers are visibly marked `SÝNI`; only the Reykjavík presentation provider routes WhatsApp testing to the owner's test phone. Provider notes now contain only their operating-area descriptions; the temporary “Sýniaðili fyrir kynningu” wording has been removed.

The five service circles cover all 2,970 records in the hosted Iceland place index. The weakest indexed point still has about 55 km of spare radius. Direct hosted verification confirmed five providers, ten vehicles, 55 provider-capability rows, and 55 vehicle-capability rows. The deployed provider screen rendered the complete network and selected-provider details without browser-console errors. Deterministic presentation IDs and the owner-only manifest at `~/.config/vegstod/presentation-network.json` allow this network to be updated or removed later without touching other records.

Four unassigned presentation jobs are positioned away from the provider bases so the job and driver markers remain distinct on the national map:

| Customer | Location | Scenario | Priority | Nearest eligible driver |
| --- | --- | --- | --- | --- |
| Sara Björnsdóttir | Borgarnes | Jump start | Normal | Katrín Magnúsdóttir, 43.7 km |
| Kristín Jónsdóttir | Blönduós | EV assistance | High | Anna S. Jónsdóttir, 99.8 km |
| Einar Pálsson | Höfn í Hornafirði | 4×4 and accident recovery | Urgent | Elín Guðmundsdóttir, 119.0 km |
| María Sigurðardóttir | Vík í Mýrdal | Tire assistance | Normal | Jón Einarsson, 70.9 km |

Each job has realistic vehicle and incident information, a visibly marked dummy customer number, its required capability rows, no assignment, and the automatically created billing record. Hosted matching returned multiple eligible providers where their radii overlap and ordered them by distance. The deployed interface showed all four active jobs, separate map markers, and the exact candidate order without browser-console errors. Their deterministic IDs are also stored in the presentation manifest for safe later cleanup.

The older provider from the physical-phone audit remains retained for owner inspection. The separate Alli live demonstration added one provider and one accepted job, so the hosted dashboard currently reports seven active providers and five active jobs. The retained audit and Alli records should each be removed with their related Auth, Storage, and database rows after inspection.

## Planned WhatsApp Cloud API production slice

The physical-phone audit proved the message content, secure links, and customer/driver journeys with the manual WhatsApp handoff. Production should build on that result by integrating the official Meta WhatsApp Cloud API directly where practical.

1. Vegstoð should use a dedicated business-owned WhatsApp number rather than the owner's personal test number. The organization must create or complete its Meta Business Portfolio, WhatsApp Business Account, phone-number registration, verification, and billing setup before live credentials can be connected.
2. The first approved utility templates should cover the secure customer-intake link, driver availability request, assigned-job/access link, and later the customer payment link. Icelandic and English variants are required where the recipient flow requires them.
3. Driver availability should support structured **Laus** and **Ekki laus** replies. A positive reply can return the candidate to the dispatcher for deliberate assignment; it must not silently replace the existing manual assignment decision.
4. API sends must be correlated to the job and recipient using Meta's WhatsApp message ID. Webhooks should update an explicit `queued`/`sent`/`delivered`/`read`/`failed` lifecycle, allowing the staff timeline to show verified delivery facts rather than only that a draft was opened.
5. Sending must use an idempotent server-side outbox with safe retries and visible terminal failures. The current prepared `wa.me` action and phone call action must remain available when Meta rejects a template, the API is unavailable, or the registered number cannot receive WhatsApp messages.
6. Access tokens stay server-only, webhook verification and signature checks happen before processing, and inbound events are deduplicated. Recipient opt-in and opt-out evidence must be stored, and business-initiated messages must follow Meta's approved-template and 24-hour customer-service-window rules.
7. WhatsApp remains a delivery and response channel. Customer details, exact locations, notes, photos, billing data, and operational state stay in Vegstoð and private Supabase storage. Messages contain the minimum operational summary and expiring Vegstoð links; the existing one-time customer and driver access controls remain unchanged.
8. Template-message fees and delivery policy are operational costs of this slice. Supabase does not need to be upgraded solely for the integration; capacity, retry volume, retention, and uptime should drive any later infrastructure upgrade.

This slice is complete only after sandbox tests, template approval, webhook verification, retry/failure tests, opt-out handling, manual-fallback tests, and a real-phone pass prove customer delivery, driver replies, assignment delivery, one-time link use, and accurate staff-timeline statuses.

## Full verification snapshot

The complete current working tree was rechecked on 6 September 2026:

- `npm run build` passed with all application routes, including dispatcher, staff billing, the staff job timeline, customer intake, private photo delivery, passwordless driver-link confirmation, and the driver screen.
- `npm run typecheck` and `npm run lint` passed without errors.
- `npm test` passed all 124 tests across 24 Vitest files, including customer and driver WhatsApp handoffs, one-time driver-link validation, and international-number routing.
- `npx supabase test db` passed all 176 assertions across seven pgTAP files, covering the dispatch schema, indexed HMS reverse geocoding, driver isolation/access management, customer-link lifecycle and first opening, private-photo authorization, contact-event audit isolation, billing handoff, financial transitions, value locking, audited-only mutation privileges, function execution grants, and driver financial isolation.
- `npx supabase db lint --local --schema public` reported no application-schema errors. A whole-database lint also reports known analyzer findings inside Supabase's installed PostGIS extension functions; these are vendor extension code rather than Vegstoð migrations.
- `npm audit --omit=dev` reported zero production dependency vulnerabilities.
- `git diff --check` passed, and the repository scan found no committed Mapbox token, Supabase secret, placeholder TODO/FIXME, or accidental application debug logging. The importer intentionally prints its completed import summary when run from the terminal.

The existing browser verification remains valid for the critical dispatcher → customer → driver path, including an unauthenticated phone-sized customer session, a real private image upload, one-time customer-link consumption, reassignment, driver-only visibility, and rejection of an anonymous private-photo request. A fresh hosted pass on 6 September exercised the automatic Git Preview through provider and vehicle creation, the former driver-invitation path, customer intake, assignment, every driver status through completion, five financial audit actions through full settlement, timeline aggregation, access revocation, and complete cleanup; see [`docs/hosted-audit-2026-09-06.md`](hosted-audit-2026-09-06.md). The follow-up current-revision pass exercised new and returning WhatsApp driver links, one-time use, assignment handoff auditing, phone-sized assigned-job visibility, driver acceptance, revocation, direct persistence checks, and complete cleanup; see [`docs/hosted-whatsapp-driver-audit-2026-09-06.md`](hosted-whatsapp-driver-audit-2026-09-06.md). The physical Android pass additionally covered native photo selection, dialer and WhatsApp browser handoffs, dispatcher assignment, driver acceptance, exact map rendering, authorized photo delivery, and progression to `en_route`. The application produced no application-console errors after the development-origin fix; headless Chromium emitted only its known WebGL software-rendering performance warnings while drawing MapLibre, while the Android map cancelled superseded OpenStreetMap tile requests during normal redraws.

## Current readiness boundary

The implemented flows are complete locally, and the complete dispatcher → customer → driver → billing path has passed against the hosted Supabase Free project and public Vercel Preview on a physical phone. The product is still not declared production-ready: the owner must finish inspecting and clean the retained test data, replace the simplified administrator testing password with a unique production password, and approve the operational launch checklist. The current link is a preview environment rather than a production release.

## Next slices

1. Let the owner inspect the completed phone-audit job from the staff interface, then delete its disposable database, Storage, and Auth records.
2. Replace the simplified administrator testing password with a unique production password before launch, and remove the linked WhatsApp Web device if it should not remain connected.
3. Set up a dedicated Vegstoð business number and Meta WhatsApp Business assets, then implement the planned Cloud API messaging, delivery webhooks, driver availability replies, failure handling, and manual fallback.
4. Promote a reviewed build to production only after the launch checklist is approved; upgrade the same Supabase project later when capacity, uptime, backup, or support requirements justify it.
5. Select and integrate Iceland-compatible accounting/invoicing and payment providers only after an accountant confirms the invoice, VAT, refund, credit-note, provider-payment, and reconciliation requirements. Customer payment links should use the Cloud API with the manual WhatsApp handoff as fallback.

## Intended end-to-end workflow

```text
Customer calls dispatcher
        -> dispatcher creates the job
        -> Vegstoð sends a secure customer link through WhatsApp
        -> customer confirms location and uploads photos
        -> Vegstoð asks suitable drivers about availability
        -> driver replies Laus or Ekki laus
        -> dispatcher assigns one operator/driver and vehicle
        -> Vegstoð sends the assigned driver's secure access link
        -> driver accepts in the Vegstoð driver screen
        -> driver calls/navigates and updates job status
        -> dispatcher follows the same job through completion
        -> completed job becomes ready in Uppgjör
        -> Vegstoð invoices and collects from the payer
        -> Vegstoð sends the customer payment link through WhatsApp
        -> Vegstoð approves and pays the provider separately
        -> both paid legs mark the case fully settled
```

## Deferred deliberately

- Automated push notifications and SMS escalation.
- Automatic dispatch.
- Continuous background driver tracking.
- Native iOS/Android applications.
- Automated legal invoice/accounting synchronization, online payment collection, refunds/credit notes, and bank payouts.
- Rental-company and insurer account integrations beyond manual payer/reference capture.
