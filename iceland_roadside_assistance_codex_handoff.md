# Icelandic Roadside Assistance Platform — Codex Handoff

> This file contains the original product brief. After the 5 September 2026 maintenance shutdown, resume with [`docs/maintenance-handoff.md`](docs/maintenance-handoff.md). For the implemented system and agreed build order, see [`docs/implementation-status.md`](docs/implementation-status.md).
>
> Current decisions that supersede early options in this brief: MapLibre/OSM plus local HMS search and map-pin reverse lookup replaced Mapbox; service provider and driver are one operator record; dispatch contacts drivers manually through normal WhatsApp/WhatsApp Web and sends a private passwordless Vegstoð access link to the registered phone after assignment; drivers do not receive email or create passwords; dispatch also sends the customer's expiring account-free Vegstoð intake link through a direct prepared WhatsApp handoff, while location, details, and private photo uploads remain inside Vegstoð; every payer pays Vegstoð and Vegstoð separately settles with the service provider through the staff-only Uppgjör workflow; each job now has a separate staff-only unified operational, contact, customer, and billing timeline.
>
> The implementation-status document also contains the local verification record, the physical Android USB test, and the hosted Vercel Preview/Supabase Free smoke pass. The remaining boundary is a physical-phone test over that public HTTPS preview with the passwordless driver link plus launch setup. SMTP is not part of the customer or driver workflow. Use the implementation-status document as the source of truth before calling the system production-ready.

## 1. Project Purpose

Build a web-based dispatch and operations platform for a new Icelandic roadside-assistance company.

The company will receive roadside-assistance requests directly from customers and centrally control which roadside operator handles each job.

The company is building a nationwide network of independent roadside-assistance providers and towing operators around Iceland.

Expected operating scale is small:

- Approximately 20–30 active roadside operators/drivers.
- Up to approximately 50 assistance jobs per day.
- Iceland is the primary and initial market.
- Manual dispatch by the company operator is preferred for the MVP.
- The system should be designed cleanly enough to expand later.

This is **not only a towing application**.

It must support general roadside assistance from the beginning.

---

## 2. Core Product Idea

The first product is a **dispatcher web application**.

The dispatcher should be able to open one interface and see:

- An interactive map of Iceland.
- All registered roadside operators.
- Operator locations or operating bases.
- Operator availability.
- Operator capabilities.
- Operator vehicles/equipment.
- Service areas.
- Active jobs.
- Unassigned jobs.
- Assigned jobs.
- Job status.

When a customer calls for help, the dispatcher should:

1. Create a new job.
2. Enter or select the breakdown location.
3. Select what kind of roadside assistance is required.
4. See suitable nearby operators.
5. Manually choose the operator who should handle the job.
6. Track the job until completion.

The dispatcher remains in control.

Do **not** automatically assign jobs in the MVP.

The system may rank or suggest appropriate operators, but the final dispatch decision should be manual.

---

## 3. Language Requirement

### Backend / Code

Use **English** for all internal technical naming:

- Database tables.
- Database columns.
- TypeScript types.
- Interfaces.
- Enums.
- API routes.
- Backend functions.
- Internal status values.
- Logs.
- Code comments.
- Variable names.

Examples:

```text
service_type = "jump_start"
status = "assigned"
capability = "flatbed"
```

### Frontend / User Interface

The user-facing application must be in **Icelandic**.

Examples:

```text
jump_start -> Ræsing
assigned -> Úthlutað
available -> Laus
busy -> Upptekinn
```

Do not mix English technical values directly into the visible UI.

Build the frontend so labels are mapped from internal English values to Icelandic display strings.

Prefer a simple localization layer rather than hardcoding Icelandic labels throughout components.

---

## 4. Recommended Technical Stack

### Frontend

Use a web application.

Preferred:

- Next.js
- React
- TypeScript

The application must work well on:

- Desktop.
- Laptop.
- Tablet.
- Mobile browser.

The dispatcher experience should be optimized primarily for desktop/laptop use, but remain responsive.

### Backend

Use **Supabase**.

Use Supabase as the main backend rather than combining Firebase and Supabase.

Supabase should provide:

- PostgreSQL.
- PostGIS.
- Authentication.
- Realtime where useful.
- Storage later if required.
- Database APIs / backend integration.

Start on the Supabase Free plan.

Expected system volume is extremely small relative to PostgreSQL/Supabase capacity.

### Geographic Database

Enable **PostGIS**.

Geographic queries are a core reason for choosing PostgreSQL/Supabase.

PostGIS should eventually support questions such as:

- Which available operators are closest to this breakdown?
- Which operators cover this location?
- Which operators have the required capabilities?
- Which operator is both nearby and suitable?
- Is the incident inside an operator's service area?

### Map Provider

Use a map provider separately from Supabase.

Mapbox is currently the preferred direction, but architect the map integration cleanly enough that it could be changed later.

The map layer should support:

- Iceland map.
- Address/place search.
- Pin placement.
- Coordinates.
- Reverse geocoding if useful.
- Routes/ETA later.

The actual geographic source of truth should be **latitude/longitude**, not an address string.

---

## 5. MVP Scope

The MVP should focus on the company's internal dispatch operation.

### MVP Must Include

#### Authentication

Dispatcher/admin login.

At least one admin/dispatcher role.

Do not over-engineer permissions initially, but structure auth so more roles can be added later.

#### Operator Management

Create and manage roadside operators.

Each operator should have information such as:

- Name.
- Phone.
- Company name if applicable.
- Active/inactive.
- Availability.
- Base location.
- Current location if available.
- Service area.
- Notes.
- Capabilities.
- Vehicles/equipment.

#### Vehicle Management

Vehicles should be separate entities from operators.

One operator may have one or more vehicles.

Possible vehicle data:

- Vehicle name/description.
- Registration number if useful.
- Vehicle type.
- Flatbed capability.
- Towing capability.
- 4x4 capability.
- EV suitability.
- Maximum supported vehicle weight if known.
- Heavy vehicle support.
- Active/inactive.
- Notes.

Do not assume one operator always equals one tow truck.

#### Capabilities

The platform must support general roadside assistance.

Initial capability/service categories should include at least:

- towing
- flatbed
- jump_start
- tire_assistance
- fuel_delivery
- lockout
- four_by_four_recovery
- ev_assistance
- accident_recovery
- heavy_vehicle
- other

Use clean English enum/code values internally.

Use Icelandic labels in the UI.

A job may require **multiple capabilities**.

Example:

```text
["ev_assistance", "four_by_four_recovery"]
```

This is important.

Do not model a job so that it can only ever have one capability.

#### Job Creation

Dispatcher creates jobs manually.

Initial job information should support:

- Customer name.
- Customer phone.
- Vehicle registration.
- Vehicle make/model if known.
- Vehicle type if useful.
- Location.
- Location label/address.
- Requested assistance.
- Required capabilities.
- Notes.
- Priority if useful.
- Creation timestamp.
- Assignment.
- Status.

#### Job Location

A job location should store coordinates.

Recommended structure:

```text
latitude
longitude
location_label
location_source
```

Possible location sources:

```text
search
map_pin
manual
gps
```

For MVP, prioritize:

1. Address/place search.
2. Manual map pin placement.

Customer GPS link is a later feature.

#### Dispatcher Map

The map is the heart of the MVP.

It should show:

- Operators.
- Operator status.
- Active jobs.
- Unassigned jobs.
- Selected job.
- Selected operator.

Clicking an operator should show useful operator details.

Clicking a job should show job details and suitable operators.

#### Operator Matching

The system should help the dispatcher find the best operators.

For MVP:

- Filter by availability.
- Filter by required capabilities.
- Consider operator/service area.
- Calculate distance from operator/base/current position to the job.
- Rank suitable operators by distance.

Do not automatically assign.

Example dispatcher result:

```text
1. Jón — 23 km — flatbed — available
2. Páll — 41 km — tow truck — available
3. Gummi — 19 km — busy
```

Exact route ETA can come later.

Straight-line geographic distance using PostGIS is sufficient initially if route-based ETA is not yet integrated.

#### Manual Assignment

Dispatcher selects an operator and assigns the job.

Record:

- Assigned operator.
- Assigned vehicle if applicable.
- Assignment timestamp.
- Assignment notes if needed.

Preserve assignment history where practical instead of only overwriting the current value.

#### Job Status

Suggested initial internal statuses:

```text
new
assigned
accepted
en_route
on_scene
in_progress
transporting
completed
cancelled
```

Not every job will require all statuses.

The UI should display appropriate Icelandic equivalents.

Design status handling cleanly and avoid tightly coupling application logic to Icelandic label strings.

#### Active Jobs View

Dispatcher should be able to quickly see:

- New/unassigned jobs.
- Assigned jobs.
- Jobs currently in progress.
- Completed jobs.

The primary screen should remain map-centric rather than becoming a generic admin dashboard.

---

## 6. Suggested Database Direction

Do not treat this as a final schema without review, but use this structure as the starting point.

Potential tables:

```text
profiles
operators
vehicles
capabilities
operator_capabilities
vehicle_capabilities
service_areas
jobs
job_required_capabilities
job_assignments
job_status_history
```

Depending on implementation simplicity, capabilities could also use PostgreSQL arrays/enums, but normalized relationships may be preferable where capability metadata is useful.

### Operators

Potential fields:

```text
id
name
phone
company_name
is_active
availability_status
base_location geography(Point, 4326)
current_location geography(Point, 4326)
current_location_updated_at
notes
created_at
updated_at
```

### Vehicles

Potential fields:

```text
id
operator_id
name
registration_number
vehicle_type
max_vehicle_weight
is_active
notes
created_at
updated_at
```

### Service Areas

Do not restrict service coverage to only radius circles.

Initially an operator may have:

- Base location.
- Optional service radius.

Later support true PostGIS polygons/multipolygons.

Potential fields:

```text
id
operator_id
name
area geography(MultiPolygon, 4326)
service_radius_km
created_at
updated_at
```

A practical MVP may begin with a base point + service radius, while keeping the schema ready for custom geographic service areas later.

### Jobs

Potential fields:

```text
id
customer_name
customer_phone
vehicle_registration
vehicle_make
vehicle_model
vehicle_type
location geography(Point, 4326)
location_label
location_source
status
priority
notes
created_by
created_at
updated_at
completed_at
```

### Job Assignments

Potential fields:

```text
id
job_id
operator_id
vehicle_id
assigned_by
assigned_at
accepted_at
unassigned_at
notes
```

Preserve historical assignments if a job is reassigned.

---

## 7. PostGIS Responsibilities

Use PostGIS for geographic logic rather than implementing unnecessary distance logic in frontend JavaScript.

Examples of useful operations:

- Distance from operator to incident.
- Operators within N kilometers.
- Incident contained within service polygon.
- Sort operators by geographic distance.
- Filter geography before returning results to the UI.

Use appropriate PostGIS geography types for distance calculations in kilometers/meters.

Do not prematurely optimize for huge scale.

The dataset will be small.

Correctness, maintainability, and understandable SQL are more important than micro-optimization.

---

## 8. Operator Availability

Availability must exist from the beginning.

Possible internal states:

```text
available
busy
offline
unavailable
```

The exact workflow can evolve.

For MVP, the dispatcher should be able to change an operator's availability manually.

Operator self-service availability can come later if needed.

Do not make continuous GPS tracking a requirement for MVP.

An operator can initially be represented by:

- Base location.
- Manually stored current location if needed.
- Availability state.

Continuous tracking is a later feature.

---

## 9. What Is NOT MVP

Do not allow these to distract from getting the dispatch system working.

### Customer Location Link

Later version.

Concept:

- Dispatcher creates job.
- System generates secure temporary link.
- Customer opens link.
- Customer presses "Share location".
- Browser GPS sends coordinates.
- Job map location updates.

This should eventually require:

- HTTPS.
- Random public token.
- No exposed internal job ID.
- Token expiration.
- Manual pin fallback.

Do not build this before the core dispatcher works unless implementation becomes trivial after MVP.

### Customer App

Not needed for MVP.

### Customer Portal

Not needed for MVP.

### Rental Company Portal

Later version.

Eventually rental companies may get accounts or integrations.

### Automatic Dispatch

Later.

The platform may recommend operators, but the human dispatcher decides.

### Continuous Driver GPS Tracking

Later.

Avoid storing GPS breadcrumbs every few seconds.

If live tracking is added later, store/update current location sensibly rather than filling the database with unnecessary location history.

### Automatic SMS

Later.

### WhatsApp Integration

Later.

### Route-Based ETA

Later.

Distance-based matching is enough initially.

### Billing / Invoicing Automation

Later unless the business explicitly decides it is immediately required.

### Analytics

Later.

### Rental Company API Integrations

Later.

---

## 10. UX Direction

The primary product is an **operations map**, not a traditional CRUD/admin dashboard.

The dispatcher should feel like they are operating a roadside-assistance network.

Main view concept:

```text
---------------------------------------------------------
| Search / filters / new job                           |
---------------------------------------------------------
|                                                       |
|                 ICELAND MAP                           |
|                                                       |
|      operators + incidents + active jobs             |
|                                                       |
---------------------------------------------------------
| Selected job/operator information                     |
---------------------------------------------------------
```

Desktop can use side panels around the map.

Important actions should take very few clicks.

Creating and assigning a roadside-assistance request must be fast.

The dispatcher may be on the phone with a stranded customer while using the interface.

Avoid unnecessary forms, modal chains, and administrative friction.

---

## 11. Iceland-Specific Location Considerations

Do not assume every roadside incident has a useful conventional street address.

The system must work well with:

- Rural roads.
- Ring Road locations.
- Mountain roads.
- Parking areas.
- Tourist locations.
- Road numbers.
- Remote areas.
- Coordinates.
- Manually dropped pins.

Coordinates are the location truth.

Human-readable addresses/place labels are supplementary.

---

## 12. Security Basics

Use Supabase authentication.

Use Row Level Security appropriately.

Do not expose privileged Supabase service keys to the browser.

Keep administrative operations secure.

Do not make job/customer records publicly readable.

Future customer-location links must use purpose-specific public tokens and limited server-side access rather than opening job tables publicly.

Customer phone numbers and other personal data should be treated as private operational data.

---

## 13. Implementation Philosophy

Build a clean MVP rather than an enterprise system.

Priorities:

1. Reliable.
2. Fast dispatcher workflow.
3. Clear code.
4. Strong data model.
5. Correct geography.
6. Easy to extend.
7. Cheap to operate.

Avoid:

- Microservices.
- Kubernetes.
- Unnecessary queues.
- Premature caching layers.
- Overly abstract architecture.
- Firebase + Supabase duplication.
- Heavy state-management frameworks unless clearly justified.

The anticipated load is very small.

Use Supabase/Postgres directly and keep the architecture understandable.

---

## 14. Suggested Initial Build Order

### Phase 1 — Foundation

- Create Next.js/TypeScript project.
- Connect Supabase.
- Enable PostGIS.
- Set up authentication.
- Set up localization structure.
- Create initial database migrations/schema.
- Configure RLS.

### Phase 2 — Operator Network

- Operator CRUD.
- Vehicle CRUD.
- Capability management.
- Base locations.
- Availability.
- Service radius/service area.

### Phase 3 — Map

- Iceland map.
- Operator markers.
- Operator detail panel.
- Address/place search.
- Drop-pin support.

### Phase 4 — Jobs

- Create job.
- Job location.
- Required capabilities.
- Job markers.
- Job detail panel.
- Job status.

### Phase 5 — Matching and Assignment

- PostGIS operator matching.
- Capability filtering.
- Availability filtering.
- Distance ranking.
- Manual operator assignment.
- Assignment history.

### Phase 6 — Operational Polish

- Active jobs view.
- Filters.
- Icelandic UI cleanup.
- Responsive behavior.
- Error states.
- Loading states.
- Basic audit/history.
- Deployment.

---

## 15. Decisions Already Made

Treat these as project requirements unless explicitly changed later.

- This is a general roadside-assistance platform, not only towing.
- All roadside-help categories should be supported from the data-model level immediately.
- One job may require multiple capabilities.
- The dispatcher controls who handles every job.
- The MVP is a web app.
- The primary interface is map-based.
- Supabase is the preferred backend.
- PostgreSQL + PostGIS should power geographic data and matching.
- Supabase Free should be used initially.
- Firebase is not required.
- Mapbox is the current preferred map/location provider.
- Coordinates are the geographic source of truth.
- Backend/code/database naming is English.
- Frontend/UI is Icelandic.
- Operators and vehicles are separate entities.
- Customer GPS-sharing link is planned, but not MVP.
- Automatic dispatch is not MVP.
- Continuous driver tracking is not MVP.
- The expected scale is roughly 20–30 operators and no more than approximately 50 jobs/day.

---

## 16. First Codex Task

Before writing large amounts of application code:

1. Inspect this document.
2. Propose the concrete repository structure.
3. Propose the initial PostgreSQL/PostGIS schema.
4. Propose the TypeScript domain models.
5. Propose the Icelandic localization structure.
6. Identify any architectural issue that would make the MVP harder to extend later.
7. Keep recommendations proportional to the very small expected scale.
8. Do not add unnecessary infrastructure.
9. Once the architecture is coherent, begin implementation from the foundation upward.

The first implementation milestone should be:

> A logged-in dispatcher can open the web app, see an Iceland map, and see/manage a small set of roadside operators stored in Supabase with their location, availability, vehicles, and capabilities.

Then add jobs and geographic matching.

---

## 17. Product Principle

The system should answer one operational question extremely well:

> A customer needs roadside help at this location. Who in our Iceland-wide network can handle it, and who should we send?

Everything in the MVP should support that workflow.
