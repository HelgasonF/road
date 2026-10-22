# Iceland Road Assistance dispatch

Map-centric operations software for an Icelandic roadside-assistance network. The public name is Iceland Road Assistance; Vegstoð remains the internal project name and part of existing technical identifiers. Internal identifiers are English; the dispatcher UI is Icelandic.

## Local setup

Requirements: Node.js 20.9+, npm, Docker for the local Supabase stack, and the Supabase CLI.

```bash
cp .env.example .env.local
npx supabase start
npx supabase db reset
npm run addresses:import
npm run dev
```

Copy the local Supabase URL and publishable key into `.env.local` using the variable names in `.env.example`. When that URL points to localhost, `npm run dev` resolves the local server-only `SECRET_KEY` from `supabase status` for the child process without printing or storing it. Never prefix a secret key with `NEXT_PUBLIC_`.

After `npx supabase db reset`, the local-only dispatcher login is `dispatcher@vegstod.local` with password `LocalVegstod2026`. The seed file is not applied to the linked hosted project.

The map uses MapLibre with OpenStreetMap tiles and needs no token. Address search and map-pin reverse lookup run entirely in PostgreSQL: `npm run addresses:import` streams the official [HMS Staðfangaskrá](https://hms.is/gogn-og-maelabord/grunngogntilnidurhals/stadfangaskra) and a small Icelandic place-name subset from OpenStreetMap into the local database. A pin near a registered house receives the nearest precise HMS address while retaining its exact clicked coordinates; other pins remain valid with a coordinate label. The source downloads are not committed to Git. Run the import after the first database reset and then weekly to follow the HMS update schedule.

### Android USB testing

An authorized Android development phone can reach both the local app and local Supabase through ADB without publishing either service:

```bash
adb devices -l
adb reverse tcp:3000 tcp:3000
adb reverse tcp:54321 tcp:54321
```

Open `http://127.0.0.1:3000` in Chrome on the phone. `next.config.ts` allows that loopback development origin so Next.js client chunks and hot reload load normally. This is only a local USB test path; customer links still require a real HTTPS deployment where both the app and Supabase API/Storage are reachable.

For a hosted Supabase database, set `DATABASE_URL` to its direct PostgreSQL connection string before running the importer. For a busier production deployment, set `NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` to a self-hosted or contracted OSM-compatible tile service; the default public OSM tiles are appropriate for local testing and modest interactive use, but do not provide a production SLA.

Create staff users through Supabase Auth, then explicitly activate each one in the SQL editor:

```sql
update public.profiles
set role = 'admin'
where email = 'dispatcher@example.com';
```

New Auth users receive the non-operational `pending` role by default, so accidentally enabled public signup does not grant access to customer or dispatch data.

Driver access is managed from the selected service provider in the dispatcher interface:

1. Create the service provider, vehicles, and capabilities normally.
2. Assign a job to the provider and press **Búa til tengil** in the assignment panel.
3. Iceland Road Assistance creates a private one-time access link and prepares a complete WhatsApp message. Copy it into the driver's chat in the company's WhatsApp Business app and press Send.
4. The driver opens the link, confirms **Opna ökumannsskjá**, and lands on `/driver` without an email account or password.
5. Dispatch can generate another short-lived link when needed, disable access immediately, or re-enable the same account without deleting operational data.

Driver contact is manual in the current workflow. The dashboard prepares an availability message containing only the operational area, assistance, priority, and estimated distance. Staff copy it into WhatsApp Business, read replies there, and make the assignment in Iceland Road Assistance. After assignment, staff create and copy a private one-time Supabase Auth link for that driver. The app can open a prefilled `wa.me` draft, but opening or copying it does not prove it was sent.

The earlier Meta Cloud API functions, webhook, templates, and sandbox test evidence remain in the project for possible future use. The current dashboard does not call the API sender, and its server-side send client is paused by default. No API phone-number onboarding is needed for manual WhatsApp Business messages. See the [manual WhatsApp handoff](docs/manual-whatsapp-handoff-2026-09-26.md).

Customer intake starts from the **+** button in the job list:

1. Enter only the caller's phone number and press **Búa til WhatsApp-tengil**. Staff can switch to the full form when they want to enter every field themselves; its vehicle section uses the same registration, brand dropdown/free-text fallback, rental-company, and people-count fields as the customer form.
2. Iceland Road Assistance atomically creates a pending job and 24-hour link, then shows a complete message to copy into the customer's WhatsApp Business chat. Staff press Send in WhatsApp. The raw token is available only at creation time and only its SHA-256 hash is stored.
3. The pending job remains visible in the list, but is omitted from the map and driver matching and cannot be assigned.
4. The customer uses the bilingual, account-free form to enter their name, confirm GPS/map location, choose the required assistance, describe the problem, add vehicle/rental/people details, and optionally upload up to six 10 MiB photos.
5. The customer presses **Pay and submit** once to save their details and open the fixed **10,490 ISK** myPOS checkout. The background worker verifies payment and submits those saved details once, unlocking matching and assignment even if the customer never returns. Private photos become visible to the assigned driver only after assignment.
6. After the driver's quote, dispatch enters the separate service amount and description and manually sends a second WhatsApp link to a private payment summary. The customer pays without entering their details again. A later correction form, when requested, does not charge the initial fee again.

Billing and provider settlement are handled in the separate staff-only **Uppgjör** workspace at `/billing`:

1. Every job receives one billing record automatically and appears in the financial queues without adding fields to the map-centric dispatcher workspace.
2. Staff records whether the payer is the customer, a rental company, an insurer/assistance company, or a business account. The payer always owes Iceland Road Assistance; the assigned provider never invoices the payer through this workflow.
3. When an assigned job is completed, a complete payer draft becomes ready for an Iceland Road Assistance invoice and the provider side begins waiting for the provider's invoice.
4. Staff records the Iceland Road Assistance invoice and incoming payment independently from the provider invoice approval and outgoing payment. A case is fully settled only after both money legs are paid.
5. Invoice references, due dates, payments, disputes, refunds, voids, and detail changes create an immutable staff audit trail. Refunds and voids require explicit confirmation and remain visible in separate queues. Payer values lock after invoice issuance and the provider total locks after approval.

Every job also has a staff-only **Ferill verkefnis** page at `/jobs/[jobId]/history`. It combines the job creation and status history, customer-link creation/first opening/submission, uploaded-photo metadata, driver contact attempts, assignment/acceptance/decline/reassignment, and billing audit into one newest-first view with category filters. Drivers cannot open this page or read its staff communication/financial event sources. Because normal WhatsApp and phone links leave the app, the timeline records only that the draft or phone link was opened; it never claims an external message was sent or a call connected.

The billing workspace records invoices and settlement independently of the myPOS collection integration. Its manual ledger actions do not issue a legal invoice, charge a card, initiate a bank transfer, or file VAT. The separate myPOS checkout collects the two customer payments; provider-confirmed payment does not complete the operational job or automatically settle either billing leg. Legal invoicing, accounting synchronization, refunds and provider payouts remain separate workflows.

Local customer photos are stored in the private `job-photos` Supabase Storage bucket. Uploads use short-lived signed upload tokens. Authenticated staff and the currently assigned driver request five-minute signed read URLs directly from Storage; a `storage.objects` policy ties each object path to the existing RLS-protected `job_photos` metadata. Do not make this bucket public in hosted Supabase.

The hosted Free-plan Supabase project and public Vercel Preview are configured as described in [docs/deployment.md](docs/deployment.md). Customer and driver links are delivered through WhatsApp, so the operational workflow has no SMTP dependency. Staff accounts still use administrator-managed Supabase email/password login. Passwordless driver Auth administration runs in the versioned `driver-access-v1` Supabase Edge Function after an explicit staff authorization check. Vercel uses `SUPABASE_SECRET_KEY` for validated customer-link/Storage operations and narrow payment persistence/reconciliation RPCs; it must never reach browser code.

For a UI-only preview without Docker or credentials, run:

```bash
DEMO_MODE=true npm run dev
```

Demo mode is read-only and must never be enabled in deployment.

The myPOS REST v1.1 integration includes the combined **Pay and submit** customer flow, durable drafts, background paid-intake completion, automatic dispatcher status updates, dispatcher-entered second amount/description, and a private payment summary page with manual WhatsApp handoff. It uses the owner's merchant-issued credentials. The fixed first fee is **10,490 ISK** (`MYPOS_INITIAL_FEE_ISK=10490`); dispatch enters the separate second amount in ISK. Payments are enabled on the existing online site after successful controlled phone acceptance; migrations, server credentials and minute reconciliation are configured there. Local defaults remain disabled. See [docs/MYPOS_SETUP.md](docs/MYPOS_SETUP.md) and the [hosted release record](docs/mypos-hosted-release-2026-10-21.md). Run `npm run mypos:test:system -- --full` for the repeatable zero-cost integration/regression/database suite against a disposable local clone; it never uses merchant credentials or real money.

The [21 October live phone audit](docs/live-phone-audit-2026-10-21.md) passed both payments, automatic confirmation, private photos and correction submission. The live database has no active jobs or operators; three staff accounts and one cancelled audit job with its two Paid records remain. The company owner will add their drivers/providers. The release source, migrations, tests and documentation are recorded together on `chore/vercel-git-connection`. Automatic Git deployments are disabled by `git.deploymentEnabled=false` in [vercel.json](vercel.json), so pushing this snapshot does not redeploy the app. Future releases use the manual commands in the [deployment runbook](docs/deployment.md).

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

After computer maintenance, resume with the [maintenance handoff](docs/maintenance-handoff.md). Hosted preview and Supabase operations are covered by the [deployment runbook](docs/deployment.md). See the presentation-ready [Vegstoð system flowchart](docs/vegstod-system-flowchart.md) for the complete customer → WhatsApp → dispatcher → driver → billing journey. [docs/architecture.md](docs/architecture.md) describes the repository boundaries and data-model decisions. The original product handoff is preserved in [iceland_roadside_assistance_codex_handoff.md](iceland_roadside_assistance_codex_handoff.md).

The current product decisions, completed work, and next build slices are tracked in [docs/implementation-status.md](docs/implementation-status.md).
