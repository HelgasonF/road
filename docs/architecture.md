# Architecture

## Scope

The completed application slices let authenticated staff manage the Iceland-wide network, incidents, assignments, driver access, and secure customer intake. Linked drivers receive a restricted mobile workflow for their own availability and assigned jobs; customers use an expiring job link without an account.

## Repository structure

```text
src/
  app/                         Next.js routes, layouts, and route-level errors
  features/auth/               Login, invitation confirmation, and password setup
  features/customer-intake/    Hashed links, bilingual public form, signed uploads, and photo UI
  features/dispatch/           Map-centric dispatcher workspace
  features/driver/             Mobile driver workflow and restricted actions
  features/jobs/               Job queries, validation, actions, forms, and details
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
  templates/                   Local/hosted Supabase Auth email templates
docs/                          Architecture and operational decisions
```

The route layer stays thin. Server Components read through feature queries; interactive map and forms are Client Components; all mutations cross validated Server Actions. Data access files import `server-only`.

## Data model

- `profiles` links Supabase Auth users to `pending`, `dispatcher`, `admin`, or `driver`. New users remain pending until deliberately activated.
- `operators` stores the service provider/driver identity, availability, a base point, an optional current point, and the MVP service radius. Its nullable unique `user_id` links that same person to a driver login without duplicating a driver record. Invitation, activation, and disabled timestamps expose the access lifecycle without copying Auth credentials into the public schema.
- `vehicles` belongs to an operator rather than being folded into the operator record.
- `capabilities`, `operator_capabilities`, and `vehicle_capabilities` preserve reusable metadata and many-to-many capability assignments.
- `jobs` stores coordinates as the incident truth and supports multiple required capabilities through `job_required_capabilities`.
- `customer_intake_links` stores a SHA-256 token hash, expiry, revocation, submission state, creator, and job relationship. The raw 256-bit token exists only in the generated URL returned once to dispatch.
- `job_photos` stores private object metadata and links every upload to both its job and originating customer link. Actual image bytes live in the private `job-photos` Storage bucket.
- `job_assignments` preserves reassignment history with a partial unique index for one current assignment.
- `job_status_history` records the operational timeline.
- `iceland_addresses` is a compact searchable projection of the official HMS Staðfangaskrá.
- `iceland_places` adds a small deduplicated OpenStreetMap place-name layer so bare town names rank correctly.

Latitude and longitude remain easy to edit through the Data API. Generated PostGIS `geography(Point, 4326)` columns guarantee that indexed geographic values cannot drift from those coordinates. `service_radius_km` is intentionally simple for the MVP; custom polygon coverage can later be added in a separate `service_areas` table without changing jobs, assignments, or operator identity.

## Transaction and authorization boundaries

Operator and vehicle saves touch a base row plus capability links. PostgreSQL functions perform each save atomically rather than issuing several independent browser requests. They run as the caller, so Row Level Security still applies.

The public client only receives the Supabase publishable key. Supabase cookie sessions are refreshed by `proxy.ts`, but every query and Server Action verifies the session again. RLS denies anonymous access. Staff can access the dispatch data; a driver can read only their own operator/vehicle data and jobs with a current assignment to that operator. Driver mutations use narrowly scoped RPCs that verify the linked operator and allowed workflow transition.

A server-only Supabase secret key performs Auth administration and the narrowly scoped customer-link/storage operations that cannot use a customer session. Those calls validate the hashed, unexpired, unrevoked token before returning job fields or creating signed upload/download access; the secret is never serialized to a Client Component. The private bucket has no general anonymous read policy. Staff and drivers reach a photo through an application route whose user-scoped metadata query is still constrained by RLS, and the route issues only a five-minute signed object URL after authorization.

Customer submission is atomic in PostgreSQL: a security-definer RPC locks the matching link, rejects expired/revoked/submitted tokens, updates only the customer-editable job fields, and marks the link submitted in the same transaction. Dispatcher notes remain separate from `customer_notes`. Link rotation revokes any previous open token for that job.

Driver login disabling also changes the RLS-visible operator state, so an already-issued driver token loses operational access immediately rather than waiting to expire.

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
- Driver accounts are created by dispatcher-managed email invitation and linked one-to-one to existing operators; disabling a login never deletes the operator or operational history.
- Driver contact is deliberately manual in the MVP: a normal `wa.me` link opens WhatsApp or WhatsApp Web and the dispatcher presses Send. No WhatsApp Business Platform/API integration is part of the operational core.
- Customer photos are limited to six files per link and 10 MiB per file. JPEG, PNG, WebP, HEIC, and HEIF metadata are accepted; production device testing must confirm preview behavior for each phone format.
