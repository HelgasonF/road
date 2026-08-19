# Vegstoð dispatch

Map-centric operations software for an Icelandic roadside-assistance network. Internal identifiers are English; the dispatcher UI is Icelandic.

## Local setup

Requirements: Node.js 20.9+, npm, Docker for the local Supabase stack, and the Supabase CLI.

```bash
cp .env.example .env.local
npx supabase start
npx supabase db reset
npm run dev
```

Copy the local Supabase URL and publishable/anon key printed by `supabase start` into `.env.local`. Add a public Mapbox token to render the live map.

Create staff users through Supabase Auth, then explicitly activate each one in the SQL editor:

```sql
update public.profiles
set role = 'admin'
where email = 'dispatcher@example.com';
```

New Auth users receive the non-operational `pending` role by default, so accidentally enabled public signup does not grant access to customer or dispatch data.

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
