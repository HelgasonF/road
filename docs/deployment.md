# Hosted preview and Supabase operations

Last updated: 6 September 2026

## Current hosted environment

Vegstoð currently has one external **preview** environment:

- Application: `https://vegstod.vercel.app`
- Vercel project: `freyrs-projects-fad4047a/vegstod`
- Supabase project: `Road`
- Supabase project reference: `abpmzqtbllszqqetuubp`
- Supabase region: `eu-west-1`
- Supabase plan: Free

There is no production deployment. The preview is intentionally public at the network layer so a customer can open a secure job link without a Vercel account. Staff routes still require Supabase authentication, customer routes require a random expiring one-time token, and the photo bucket remains private.

The hosted database contains the complete migration history, the official Icelandic address/place search data, and no demo operators or jobs. At the last check it used about 94 MB of the Free plan's 500 MB database allowance. The imported reference data comprised 139,346 HMS addresses and 2,970 Icelandic place names.

The initial real admin is active and its login was verified against the preview. Its generated temporary credentials are stored outside the repository at `~/.config/vegstod/first-admin.json` with owner-only file permissions. Rotate the temporary password in Supabase Auth after first use.

## Vercel configuration

The Preview and Production environments contain these encrypted variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
DEMO_MODE=false
```

`SUPABASE_SECRET_KEY` must remain server-only and must never use a `NEXT_PUBLIC_` prefix. The local `.vercel/` link metadata is ignored by Git.

Create a new preview from the linked working tree with:

```bash
npx vercel deploy --target preview
```

Point the stable phone-test address at the new deployment after it is Ready:

```bash
npx vercel alias set DEPLOYMENT_URL vegstod.vercel.app
```

Do not use `--prod` until the external phone workflow and the production checklist have been approved. Production variables are prepared, but there is no active production deployment.

## Connect Vercel to the private GitHub repository

The Git remote works over SSH, but Vercel currently returns `Failed to connect HelgasonF/road` because its GitHub App cannot see the private repository. Fix the account permission once in GitHub:

1. Open [GitHub installed applications](https://github.com/settings/installations).
2. Select **Configure** beside the Vercel application. If Vercel is not installed, install the [Vercel GitHub App](https://github.com/apps/vercel/installations/new) for the `HelgasonF` account.
3. Under **Repository access**, select **All repositories** or add the private `road` repository under **Only select repositories**, then save.
4. Confirm the GitHub account is present in [Vercel Login Connections](https://vercel.com/account/settings/authentication).
5. From this repository, connect the existing Vercel project:

   ```bash
   npx vercel git connect --yes
   ```

6. Check Vercel project **Settings → Git** and confirm `HelgasonF/road` is the connected repository. Future branch pushes will create previews; pushes to the configured production branch can create production deployments, so do not push to that branch until the release is approved.

Vercel's [GitHub repository guide](https://vercel.com/docs/git/vercel-for-github#missing-git-repository) confirms that a personal private repository requires owner access and that the installed GitHub App must have access to the repository.

## Supabase configuration

The repository is linked to the hosted project. Check and apply migrations with:

```bash
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

The hosted Auth Site URL is `https://vegstod.vercel.app`. Its allowed redirect URLs also include that address plus local `127.0.0.1:3000` and `localhost:3000` development URLs. Email confirmation and TOTP remain enabled. Public self-signup is disabled, passwords require at least 10 characters with letters and digits, and public users do not receive database function execution privileges. Hosted PostgreSQL rejects non-SSL external connections.

The repository includes branded invitation and recovery templates in `supabase/templates/`, but the Supabase Free plan's built-in mail provider does not allow custom templates. Configure a custom SMTP provider before applying those templates or sending real driver invitations. Until then, password login works, but hosted invitation/recovery email is not ready for operations.

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

Then repeat the real customer workflow on a physical phone over the public preview: staff sign-in, address search, job creation, customer WhatsApp handoff, customer location confirmation, real phone photo upload, dispatch receipt, assignment, driver sign-in, private photo access, status changes, timeline, and billing handoff. Remove all test records and Storage objects afterward.

## Moving from Free to paid Supabase

Upgrade the existing `Road` project in the Supabase organization when its limits, uptime requirements, backup requirements, or launch schedule justify it. Keeping the same project preserves its project reference, API URL, database, Storage objects, and Vercel environment variables; a second database migration is unnecessary. Review the current [Supabase billing documentation](https://supabase.com/docs/guides/platform/billing-faq) before upgrading.

The project region cannot be changed in place. If a different region is required later, plan a separate project migration. Also configure backups, custom SMTP, monitoring, and the final domain before declaring the environment production-ready. Supabase documents the relevant launch checks in its [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).
