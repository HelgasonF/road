# Vegstoð dispatch

Map-centric operations software for an Icelandic roadside-assistance network. Internal identifiers are English; the dispatcher UI is Icelandic.

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

The map uses MapLibre with OpenStreetMap tiles and needs no token. Address search runs entirely in PostgreSQL: `npm run addresses:import` streams the official [HMS Staðfangaskrá](https://hms.is/gogn-og-maelabord/grunngogntilnidurhals/stadfangaskra) and a small Icelandic place-name subset from OpenStreetMap into the local database. The source downloads are not committed to Git. Run the import after the first database reset and then weekly to follow the HMS update schedule.

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
2. Open **Ökumannsaðgangur**, enter the driver's email, and send the invitation.
3. The driver opens the email, chooses a password, and lands on `/driver`.
4. Dispatch can send a password-reset email, disable access immediately, or re-enable the same account without deleting operational data.

Driver contact in the MVP uses ordinary WhatsApp rather than an automated API. The WhatsApp action opens the registered driver's chat on a phone, WhatsApp Desktop, or WhatsApp Web; the dispatcher reviews and manually sends the message. Calling remains available as a fallback. This does not require WhatsApp Business Platform credentials.

Customer intake is managed from the selected job:

1. Create the job with at least the caller and initial incident location.
2. Open **Öruggur viðskiptavinatengill** and generate the 24-hour link. Generating another link revokes the previous one.
3. Send the returned URL to the customer. The raw token is shown only at creation time and only its SHA-256 hash is stored.
4. The customer uses the bilingual, account-free form to confirm GPS/map location, vehicle details, the problem, and up to six 10 MiB photos.
5. Submission is one-time. Dispatch sees the information immediately, and private photos become visible to the assigned driver only after assignment.

Local customer photos are stored in the private `job-photos` Supabase Storage bucket. Uploads use short-lived signed upload tokens; reads pass through an application authorization route before receiving a five-minute signed object URL. Do not make this bucket public in hosted Supabase.

Local invitation and recovery emails appear in Mailpit at `http://127.0.0.1:54324`. Hosted Supabase must set the project Site URL to the deployed Vegstoð URL and use the repository templates in `supabase/templates/` for the **Invite user** and **Reset password** email templates. `SUPABASE_SECRET_KEY` must contain a server-only `sb_secret_...` key in hosting; it is used for verified staff Auth administration and token-validated private customer-intake/storage operations, and must never reach browser code.

For a UI-only preview without Docker or credentials, run:

```bash
DEMO_MODE=true npm run dev
```

Demo mode is read-only and must never be enabled in deployment.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

See [docs/architecture.md](docs/architecture.md) for the repository boundaries and data-model decisions. The original product handoff is preserved in [iceland_roadside_assistance_codex_handoff.md](iceland_roadside_assistance_codex_handoff.md).

The current product decisions, completed work, and next build slices are tracked in [docs/implementation-status.md](docs/implementation-status.md).
