# Architecture

## Scope

The completed application slices let authenticated staff manage the Iceland-wide network, incidents, assignments, driver access, secure customer intake, a unified job timeline, and two-sided job settlement. Linked drivers receive a restricted mobile workflow for their own availability and assigned jobs; customers use an expiring job link without an account. Staff communication audit and financial data remain staff-only.

## Repository structure

```text
src/
  app/                         Next.js routes, layouts, and route-level errors
  features/auth/               Staff login and passwordless driver-link confirmation
  features/billing/            Payer receivables, provider payables, queues, and audit UI
  features/customer-intake/    Hashed links, bilingual public form, signed uploads, and photo UI
  features/dispatch/           Map-centric dispatcher workspace
  features/driver/             Mobile driver workflow and restricted actions
  features/jobs/               Job queries, validation, actions, forms, and details
  features/job-timeline/       Normalized staff-only operational and financial history
  features/location/           Local Iceland address/place search and MapLibre map-pin input
  features/operators/          Operator queries, validation, actions, and forms
  lib/auth/                    Request-time session verification
  lib/domain/                  English internal domain codes and DTOs
  lib/i18n/                    Icelandic display dictionary
  lib/supabase/                Browser/server clients and auth proxy helper
  test/                        Shared test setup
supabase/
  migrations/                  Versioned PostgreSQL/PostGIS schema
  seed.sql                     Local-only reference/demo records
docs/                          Architecture and operational decisions
```

The route layer stays thin. Server Components read through feature queries; interactive map and forms are Client Components; all mutations cross validated Server Actions. Data access files import `server-only`.

## Data model

- `profiles` links Supabase Auth users to `pending`, `dispatcher`, `admin`, or `driver`. New users remain pending until deliberately activated.
- `operators` stores the service provider/driver identity, availability, a base point, an optional current point, and the MVP service radius. Its nullable unique `user_id` links that same person to a driver session without duplicating a driver record. Access-link creation, activation, and disabled timestamps expose the lifecycle without copying Auth credentials or raw tokens into the public schema.
- `vehicles` belongs to an operator rather than being folded into the operator record.
- `capabilities`, `operator_capabilities`, and `vehicle_capabilities` preserve reusable metadata and many-to-many capability assignments.
- `jobs` stores coordinates as the incident truth and supports multiple required capabilities through `job_required_capabilities`. A phone-first row uses `intake_pending=true` until customer submission; while pending, its internal Iceland-centre placeholder is excluded from the map, matching view, and assignment workflow.
- `customer_intake_links` stores a SHA-256 token hash, expiry, first verified page opening, revocation, submission state, creator, and job relationship. The raw 256-bit token exists only in the generated URL returned once to dispatch.
- `job_photos` stores private object metadata and links every upload to both its job and originating customer link. Actual image bytes live in the private `job-photos` Storage bucket.
- `job_assignments` preserves reassignment history with a partial unique index for one current assignment.
- `job_status_history` records the operational timeline.
- `job_contact_events` records staff-initiated WhatsApp-draft and phone-link openings by job, operator, purpose, actor, and time. It deliberately does not claim an external send, answer, or response.
- `job_billing` is a one-to-one financial record created automatically for every job. It stores payer identity and authorization, the amount owed to Vegstoð, the amount Vegstoð owes the assigned provider, and separate receivable/payable lifecycle fields.
- `job_billing_events` is the append-only staff audit trail for detail changes, invoice actions, payments, disputes, reopenings, refunds, and voids.
- `iceland_addresses` is a compact searchable projection of the official HMS Staðfangaskrá.
- `iceland_places` adds a small deduplicated OpenStreetMap place-name layer so bare town names rank correctly.

Latitude and longitude remain easy to edit through the Data API. Generated PostGIS `geography(Point, 4326)` columns guarantee that indexed geographic values cannot drift from those coordinates. `service_radius_km` is intentionally simple for the MVP; custom polygon coverage can later be added in a separate `service_areas` table without changing jobs, assignments, or operator identity.

## Transaction and authorization boundaries

Operator and vehicle saves touch a base row plus capability links. PostgreSQL functions perform each save atomically rather than issuing several independent browser requests. They run as the caller, so Row Level Security still applies.

The public client only receives the Supabase publishable key. Supabase cookie sessions are refreshed by `proxy.ts`, but every query and Server Action verifies the session again. RLS denies anonymous access. Staff can access the dispatch data; a driver can read only their own operator/vehicle data and jobs with a current assignment to that operator. Driver mutations use narrowly scoped RPCs that verify the linked operator and allowed workflow transition.

A server-only Supabase secret key performs Auth administration and the narrowly scoped customer-link/storage operations that cannot use a customer session. Those calls validate the hashed, unexpired, unrevoked token before returning job fields or creating signed upload/download access; the secret is never serialized to a Client Component. The private bucket has no general anonymous read policy. Staff and drivers reach a photo through an application route whose user-scoped metadata query is still constrained by RLS, and the route issues only a five-minute signed object URL after authorization.

Phone-first creation is atomic in PostgreSQL: a staff-only function creates the pending job and hashed customer link together. Customer submission is also atomic: a security-definer RPC locks the matching link, rejects expired/revoked/submitted tokens, updates only the customer-editable job fields, replaces the matching requirement with the selected assistance type, clears `intake_pending`, and marks the link submitted in the same transaction. Dispatcher notes remain separate from `customer_notes`. Link rotation revokes any previous open token for that job.

Driver login disabling also changes the RLS-visible operator state, so an already-issued driver token loses operational access immediately rather than waiting to expire.

Driver access is passwordless and delivered manually through WhatsApp. A staff-only Server Action uses the server-only Supabase key to generate an Auth link for an internal, non-routable driver identifier. Vegstoð returns only a first-party `/driver/access` URL to the authenticated dispatcher. Opening that URL displays a confirmation button instead of immediately consuming the token, so link-preview requests do not sign in or invalidate the link. The confirmed one-time token creates the normal Supabase cookie session, after which all driver reads and mutations remain constrained by the existing driver RLS policies. The internal Auth identifier is never requested from or shown to the driver.

Billing has two deliberately independent state machines: payer → Vegstoð is a receivable, while Vegstoð → provider is a payable. Completing a job triggers the initial financial handoff, but receiving payer money never marks the provider paid and paying the provider never marks the payer settled. Staff-only, security-definer RPCs validate every invoice/payment transition and write its audit event in the same database operation. Drivers receive no table policy for billing records, prices, margin, or financial events.

The staff-only timeline route normalizes existing source-of-truth rows rather than copying them into a second generic activity table. Job creation, status history, customer-link lifecycle, uploaded photos, assignment lifecycle, driver contact attempts, and billing events remain owned by their domain tables and are merged newest-first at read time. The only added audit facts were `customer_intake_links.first_opened_at` and append-only `job_contact_events`; drivers have no RLS policy for the contact table or timeline route.

Invoice values are mutable while a record is incomplete or in draft. A database trigger locks payer identity, service description, and payer total after invoice issuance, and locks the provider total after provider-invoice approval. Internal notes remain editable and audited. This preserves the recorded document amounts while leaving future credit-note or supplemental-invoice integration as a separate workflow.

## Map and location data

MapLibre renders a raster basemap, using OpenStreetMap tiles by default. The tile URL and required attribution are configurable public build-time values, so a production operator can switch to self-hosted tiles without changing the application. No map token or geocoding API is required.

Address and place searches are PostgreSQL RPC calls protected by the same staff session and RLS boundaries as operational data. `scripts/import-hms-addresses.mjs` downloads and normalizes the official weekly HMS CSV, downloads only Icelandic `place=*` objects from OpenStreetMap, loads both into temporary tables, and atomically replaces the live search indexes. The downloaded source files never enter the repository.

## Localization

English codes are the domain contract. `src/lib/i18n/is.ts` owns the Icelandic dictionary and enum-label maps. Components receive or import display strings; database values never double as visible labels. A type-level dictionary contract and unit tests make missing labels visible during development.

## Deliberate MVP constraints

- One Next.js application and one Supabase project; no extra API service, queue, or cache.
- Manual dispatch remains authoritative.
- Provider ranking uses straight-line PostGIS distance, capability coverage, availability, and service radius; road-network ETA can replace the distance input later.
- Current location is a manually maintained point, not continuous tracking.
- Public OpenStreetMap raster tiles have no service-level guarantee; production traffic should use a self-hosted or contracted compatible tile endpoint.
- Driver accounts are created from dispatcher-generated passwordless links sent to the registered phone through ordinary WhatsApp and linked one-to-one to existing operators; drivers do not provide an email or password, and disabling access never deletes the operator or operational history.
- Driver contact is deliberately manual in the MVP: normal `wa.me` links open WhatsApp or WhatsApp Web and the dispatcher presses Send. Candidate messages are built from a narrow operational summary that cannot contain customer contact details, notes, photos, or intake tokens; house numbers and raw map coordinates are removed from the pre-assignment area label. The post-assignment variant generates a fresh, expiring one-time driver access URL for any non-disabled assigned operator. Contact-link openings are audited, but an external send or connected call cannot be verified. No WhatsApp Business Platform/API integration is part of the operational core.
- Customer-link delivery uses the same manual `wa.me` handoff: the default **+** flow asks only for the phone number, atomically creates a pending job and raw intake token, and opens the customer's registered WhatsApp number with clear English instructions and the secure URL. Staff can switch to the complete job form. Pending jobs cannot enter map matching or assignment. The form data and photos are submitted to Vegstoð and private Supabase Storage, not sent through WhatsApp. The raw URL is not recoverable from the stored hash, so resending later requires rotating to a new link.
- Customer photos are limited to six files per link and 10 MiB per file. JPEG, PNG, WebP, HEIC, and HEIF metadata are accepted; production device testing must confirm preview behavior for each phone format.
- The billing workspace records external invoice/payment facts but does not create legal invoices, charge payment methods, send bank transfers, calculate/file VAT, or synchronize an accounting package. Production payment and accounting integrations remain separate from the validated internal ledger.
