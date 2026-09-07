# Hosted preview and Supabase operations

Last updated: 7 September 2026

## Current hosted environment

Vegstoð currently has one external **preview** environment:

- Application: `https://vegstod.vercel.app`
- Vercel project: `freyrs-projects-fad4047a/vegstod`
- Supabase project: `Road`
- Supabase project reference: `abpmzqtbllszqqetuubp`
- Supabase region: `eu-west-1`
- Supabase plan: Free

There is no production deployment. The preview is intentionally public at the network layer so customers and drivers can open their secure links without a Vercel account. Staff routes still require Supabase authentication, customer routes require a random expiring one-time token, driver links establish a restricted Supabase session after explicit confirmation, and the photo bucket remains private.

The hosted database contains the complete migration history and the official Icelandic address/place search data. The public-phone audit dataset and the Alli stakeholder-demonstration dataset are temporarily retained for owner inspection; they are test data and must be removed afterward using their owner-only manifests. At the last check the database used about 94 MB of the Free plan's 500 MB allowance. The imported reference data comprised 139,346 HMS addresses and 2,970 Icelandic place names.

Customer intake section 2 stores the selected or customer-entered vehicle make, optional rental-company name, and number of people involved. The rental company and people count use dedicated `jobs` columns and the server-only `submit_customer_intake_v2` function; the original function remains temporarily available for compatibility with an older in-flight preview.

The automatic Git Preview completed the full hosted dispatcher → customer → driver → billing workflow on 6 September 2026. A follow-up on commit `ba61a50` verified the replacement passwordless WhatsApp driver links through provider and job creation, assignment handoff, clean-session redemption, one-time reuse rejection, returning access, driver acceptance, and immediate disable. A final physical-phone pass used installed WhatsApp, GPS, the native photo picker, the one-time driver link, private-photo display, every driver status, the staff timeline, and billing handoff over public HTTPS. On 7 September, Alli completed another real WhatsApp customer and driver pass; the reported portrait-thumbnail cropping was corrected and the same job was reassigned to the owner's test driver for verification. See [`docs/hosted-audit-2026-09-06.md`](hosted-audit-2026-09-06.md), [`docs/hosted-whatsapp-driver-audit-2026-09-06.md`](hosted-whatsapp-driver-audit-2026-09-06.md), [`docs/public-phone-audit-2026-09-06.md`](public-phone-audit-2026-09-06.md), and [`docs/alli-live-demo-2026-09-07.md`](alli-live-demo-2026-09-07.md).

The initial real admin is active and its login was verified against the preview. Its simplified testing credentials are stored outside the repository at `~/.config/vegstod/first-admin.json` with owner-only file permissions. The password must never be committed and must be replaced with a unique production password before launch.

## Vercel configuration

The Preview and Production environments contain these encrypted variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
DEMO_MODE=false
```

`SUPABASE_SECRET_KEY` must remain server-only and must never use a `NEXT_PUBLIC_` prefix. It generates driver Auth links and performs the narrowly scoped customer-link and Storage operations. The local `.vercel/` link metadata is ignored by Git.

Create a new preview from the linked working tree with:

```bash
npx vercel deploy --target preview
```

Point the stable phone-test address at the new deployment after it is Ready:

```bash
npx vercel alias set DEPLOYMENT_URL vegstod.vercel.app
```

Do not use `--prod` until the external phone workflow and the production checklist have been approved. Production variables are prepared, but there is no active production deployment.

## GitHub automatic deployments

Vercel is connected to the private GitHub repository `HelgasonF/road`. The production branch is `main`. Use feature branches for work that should remain in Preview:

```bash
git switch -c feature/short-description
git push -u origin feature/short-description
```

Each pushed feature branch receives an automatic Vercel Preview deployment. A push or merge to `main` creates a Production deployment, so merge only after the public-phone and launch checklists pass.

If Vercel loses repository access, open [GitHub installed applications](https://github.com/settings/installations), configure the Vercel application, and confirm that its repository access includes `road`. Also confirm GitHub appears in [Vercel Login Connections](https://vercel.com/account/settings/authentication), then reconnect with `npx vercel git connect --yes`. Vercel documents these permissions in its [GitHub repository guide](https://vercel.com/docs/git/vercel-for-github#missing-git-repository).

## Supabase configuration

The repository is linked to the hosted project. Check and apply migrations with:

```bash
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

The hosted Auth Site URL is `https://vegstod.vercel.app`. Its allowed redirect URLs also include that address plus local `127.0.0.1:3000` and `localhost:3000` development URLs. Email/password authentication and TOTP remain available for staff accounts. Public self-signup is disabled, staff passwords require at least 10 characters with letters and digits, and public users do not receive database function execution privileges. Hosted PostgreSQL rejects non-SSL external connections.

Drivers do not receive email and do not create passwords. An authenticated staff action generates a one-time Supabase Auth token for an internal, non-routable identifier and returns a first-party `/driver/access` URL. Dispatch places that URL in the prepared WhatsApp message. The driver must press **Opna ökumannsskjá** before the token is consumed; successful confirmation creates the ordinary Supabase cookie session used by the existing driver RLS policies. A later assignment can generate a fresh link, and disabling the operator immediately removes access from an existing session. SMTP is not part of the customer or driver workflow.

Create each additional staff user in Supabase Auth, then activate it explicitly:

```sql
update public.profiles
set role = 'admin'
where email = 'dispatcher@example.com';
```

New users remain `pending` by default. Never grant staff access by changing the default role.

## Address refresh

Run the importer against hosted PostgreSQL only with a protected direct connection string:

```bash
DATABASE_URL='postgresql://…' npm run addresses:import
```

The source files are downloaded at run time and are not committed. Refresh the HMS data weekly. Keep the existing data until the replacement transaction completes.

## Verification before a production release

Run the repository checks:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx supabase test db
npx supabase db lint --local --schema public
```

Then repeat the real customer workflow on a physical phone over the public preview: staff sign-in, address search, job creation, customer WhatsApp handoff, customer location confirmation, real phone photo upload, dispatch receipt, assignment, driver WhatsApp access-link confirmation, private photo access, status changes, timeline, and billing handoff. Confirm that a used driver link fails in a clean session and that disabling the driver removes an existing session immediately. Remove all test records, Auth users, and Storage objects afterward.

## Moving from Free to paid Supabase

Upgrade the existing `Road` project in the Supabase organization when its limits, uptime requirements, backup requirements, or launch schedule justify it. Keeping the same project preserves its project reference, API URL, database, Storage objects, and Vercel environment variables; a second database migration is unnecessary. Review the current [Supabase billing documentation](https://supabase.com/docs/guides/platform/billing-faq) before upgrading.

The project region cannot be changed in place. If a different region is required later, plan a separate project migration. Also configure backups, monitoring, and the final domain before declaring the environment production-ready. Supabase documents the relevant launch checks in its [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).
