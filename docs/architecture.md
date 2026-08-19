# Architecture

## Scope

The completed dispatcher slice lets authenticated staff view Iceland, manage operators and their equipment, create incidents from an address or map pin, rank providers by capability and distance, assign a vehicle, and move a job through its operational status lifecycle.

## Repository structure

```text
src/
  app/                         Next.js routes, layouts, and route-level errors
  features/auth/               Login/logout actions and UI
  features/dispatch/           Map-centric dispatcher workspace
  features/jobs/               Job queries, validation, actions, forms, and details
  features/location/           Iceland-only Mapbox address and map-pin input
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

- `profiles` links Supabase Auth users to `pending`, `dispatcher`, or `admin`. New users remain pending until deliberately activated.
- `operators` stores operational identity, availability, a base point, an optional current point, and the MVP service radius.
- `vehicles` belongs to an operator rather than being folded into the operator record.
- `capabilities`, `operator_capabilities`, and `vehicle_capabilities` preserve reusable metadata and many-to-many capability assignments.
- `jobs` stores coordinates as the incident truth and supports multiple required capabilities through `job_required_capabilities`.
- `job_assignments` preserves reassignment history with a partial unique index for one current assignment.
- `job_status_history` records the operational timeline.

Latitude and longitude remain easy to edit through the Data API. Generated PostGIS `geography(Point, 4326)` columns guarantee that indexed geographic values cannot drift from those coordinates. `service_radius_km` is intentionally simple for the MVP; custom polygon coverage can later be added in a separate `service_areas` table without changing jobs, assignments, or operator identity.

## Transaction and authorization boundaries

Operator and vehicle saves touch a base row plus capability links. PostgreSQL functions perform each save atomically rather than issuing several independent browser requests. They run as the caller, so Row Level Security still applies.

The public client only receives the Supabase publishable key. Supabase cookie sessions are refreshed by `proxy.ts`, but every query and Server Action verifies the session again. RLS denies anonymous access and grants operational access only to staff profiles. No service-role key is used by the application.

## Localization

English codes are the domain contract. `src/lib/i18n/is.ts` owns the Icelandic dictionary and enum-label maps. Components receive or import display strings; database values never double as visible labels. A type-level dictionary contract and unit tests make missing labels visible during development.

## Deliberate MVP constraints

- One Next.js application and one Supabase project; no extra API service, queue, or cache.
- Manual dispatch remains authoritative.
- Provider ranking uses straight-line PostGIS distance, capability coverage, availability, and service radius; road-network ETA can replace the distance input later.
- Current location is a manually maintained point, not continuous tracking.
- Mapbox is isolated behind one map component so another provider can replace it later.
