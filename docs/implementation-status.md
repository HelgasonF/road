# Vegstoð implementation status

Last updated: 20 August 2026

## Product decisions

- A service provider and driver are the same operational person in the MVP.
- The existing `operators` record remains the source of truth for that person, their phone, availability, base/current location, service radius, capabilities, and vehicles.
- A driver login is an authentication link to an operator; it is not a second driver or company record.
- Dispatch remains manual. Matching suggests suitable operators, but a dispatcher makes the assignment.
- Drivers use a dedicated mobile-first Vegstoð screen for operational job data.
- Driver availability contact in the MVP is a normal manual WhatsApp message opened from Vegstoð on a phone or computer. The dispatcher reviews and presses Send, so no paid WhatsApp Business Platform/API automation is required. Calling remains the fallback.
- A customer does not need an account. A 24-hour, job-specific link collects a confirmed location, vehicle details, problem description, and private photos.

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

## Full verification snapshot

The complete current working tree was rechecked on 20 August 2026:

- `npm run build` passed with all application routes, including dispatcher, customer intake, private photo delivery, authentication confirmation/password setup, and the driver screen.
- `npm run typecheck` and `npm run lint` passed without errors.
- `npm test` passed all 99 tests across 17 Vitest files.
- `npx supabase test db` passed all 109 assertions across four pgTAP files, covering the dispatch schema, driver isolation/access management, customer-link lifecycle, and private-photo authorization.
- `npx supabase db lint --local --schema public` reported no application-schema errors. A whole-database lint also reports known analyzer findings inside Supabase's installed PostGIS extension functions; these are vendor extension code rather than Vegstoð migrations.
- `npm audit --omit=dev` reported zero production dependency vulnerabilities.
- `git diff --check` passed, and the repository scan found no committed Mapbox token, Supabase secret, placeholder TODO/FIXME, or accidental application debug logging. The importer intentionally prints its completed import summary when run from the terminal.

The existing browser verification remains valid for the critical dispatcher → customer → driver path, including an unauthenticated phone-sized customer session, a real private image upload, one-time link consumption, reassignment, driver-only visibility, and rejection of an anonymous private-photo request. A fresh Playwright smoke pass also confirmed that Bjarni can still sign in, sees only his assigned job with the correct Iceland map pin, customer call/WhatsApp actions, submitted notes and authorized private photo, and is redirected from `/` back to `/driver`. A separate anonymous 390 × 844 session received the safe unavailable state for an invalid customer link, and an anonymous private-photo request still returned HTTP 404. The application produced no browser-console errors; headless Chromium emitted only its known WebGL software-rendering performance warnings while drawing MapLibre.

## Current readiness boundary

The implemented flows are complete and verified locally, but the product is not yet declared production-ready. Customer links currently use the local application origin, and browser uploads use the configured Supabase URL. A real customer phone therefore needs both the Vegstoð app and the Supabase API/Storage endpoint to be securely reachable; exposing only the Next.js page through a tunnel is not enough. No customer should receive a `localhost` link.

## Next slices

1. Add a clearer job event timeline covering customer submission, availability contact, assignment, acceptance, reassignment, and completion.
2. Create a secure phone-test environment in which both the app and Supabase API/Storage are reachable, then test the complete dispatcher → customer → driver flow on iPhone and Android.
3. Connect hosted Supabase and production email only after the real-phone workflow is approved.

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
```

## Deferred deliberately

- Automated push notifications and SMS escalation.
- Automatic dispatch.
- Continuous background driver tracking.
- Native iOS/Android applications.
- WhatsApp Business automation.
- Billing and rental-company integrations.
