# Road / Vegstoð maintenance handoff

Updated: 6 September 2026 (Atlantic/Reykjavik)

This is the current resume point for local work and the hosted preview.

## Resume from the correct repository

The active Git repository is:

```text
/mnt/ssd4tb/web-apps/Road
```

The older `/mnt/ssd4tb/Road` path is **not** the repository. At this checkpoint it contains only a leftover `.next` build directory. If a future terminal or Codex session starts there, change to the active repository before doing any work:

```bash
cd /mnt/ssd4tb/web-apps/Road
git status --short
```

## Restart after maintenance

Start Docker first if it did not start automatically, then run:

```bash
cd /mnt/ssd4tb/web-apps/Road
npx supabase start
npm run dev
```

Open `http://127.0.0.1:3000` on the computer.

Do **not** run `npx supabase db reset` during a normal restart. The local Supabase volumes contain the current application data and imported Icelandic address register. A normal computer shutdown preserves those volumes.

For another Android USB test, reconnect and authorize the phone before running:

```bash
adb devices -l
adb reverse tcp:3000 tcp:3000
adb reverse tcp:54321 tcp:54321
```

Then open `http://127.0.0.1:3000` in Chrome on the phone.

## Current checkpoint state

- Git branch: `main`.
- Git remote: `origin` → `git@github.com:HelgasonF/road.git`.
- This checkpoint includes the map/address, customer WhatsApp, Android-origin, flowchart, hosted Supabase, deployment, and function-permission work completed after `2c3a1fd`.
- Confirm the exact revision with `git log -1 --oneline` and verify `git status --short` is clean before starting another slice.
- The local Supabase Docker stack preserves the current application data and imported Icelandic address register. Restart it with `npx supabase start` if needed.
- No Android device is currently connected through ADB.
- Temporary local and hosted browser-verification users, jobs, customer links, and uploaded test data were removed after testing.

Do not reset or overwrite local database volumes during a normal restart. Review `git status --short` first.

## Checkpoint work completed after `2c3a1fd`

### Map and Icelandic addresses

- Drivers always use a `D` marker and jobs use a `V` marker.
- Job markers no longer have a service-radius circle.
- Overlapping driver/job markers are separated so both remain visible.
- Map-pin selection now reverse-geocodes against the local official HMS address register.
- The exact clicked coordinates remain the routing truth; the nearby registered address is only the display label.
- A registered address is selected only within 250 metres. Otherwise the coordinate label remains valid rather than attaching a misleading distant address.
- The indexed database lookup and the browser flow were verified using `Bæjarlind 8, 201`.

Relevant files include:

- `src/features/dispatch/iceland-map.tsx`
- `src/features/location/actions.ts`
- `src/features/location/address-search-field.tsx`
- `src/features/location/hms.ts`
- `supabase/migrations/20260823090000_add_iceland_reverse_geocoding.sql`
- `supabase/tests/dispatch_schema.test.sql`

### Direct customer WhatsApp handoff

- The copy-and-paste customer-link workflow was removed.
- After generating a secure 24-hour intake link, dispatch now receives a direct **Senda í WhatsApp** action for the customer's registered number.
- The prepared customer message is English only and contains the customer's name, simple instructions, the secure Vegstoð URL, the 24-hour expiry, and a warning not to forward it.
- WhatsApp carries only the message and secure link. Location, vehicle information, problem details, and photos are submitted to Vegstoð and private Supabase Storage.
- Dispatch still reviews the prepared message and presses Send in ordinary WhatsApp/WhatsApp Web. No paid WhatsApp Business API is involved.
- A real browser handoff reached WhatsApp with the correct international number and secure URL. No message was sent and all disposable records were cleaned up.

Relevant files include:

- `src/features/customer-intake/customer-contact.ts`
- `src/features/customer-intake/customer-contact.test.ts`
- `src/features/customer-intake/customer-link-panel.tsx`
- `src/features/customer-intake/customer-link-panel.test.tsx`
- `src/features/jobs/job-detail.tsx`

### Android development access

- `next.config.ts` allows the Android USB loopback development origin so Next.js chunks and hot reload work through ADB reverse forwarding.
- This is only a local development path. It is not a customer-deliverable HTTPS deployment.

### Presentation flowchart

- The complete customer → WhatsApp → dispatch → driver → billing flow is documented in `docs/vegstod-system-flowchart.md`.
- The customer WhatsApp step uses plain wording: **með enskum texta + tengli**.
- The separate **Ferill verkefnis** note box was removed at the user's request.
- Presentation exports:
  - `docs/assets/vegstod-system-flowchart.png`
  - `docs/assets/vegstod-system-flowchart.svg`
- Editable Graphviz source: `docs/vegstod-system-flowchart.dot`.

### Hosted preview and Supabase Free project

- Supabase project `Road` (`abpmzqtbllszqqetuubp`) is linked in `eu-west-1` on the Free plan.
- All 19 migrations are applied. Hosted reference data contains 139,346 HMS addresses and 2,970 Icelandic place names; the database used about 94 MB at the last check.
- The private `job-photos` bucket and tightened function execution permissions are verified.
- Vercel Preview uses encrypted Supabase variables with `DEMO_MODE=false` and the stable address `https://vegstod.vercel.app`. The same encrypted variables are prepared for Production, but no production deployment is active.
- Supabase Auth Site URL and redirects use the stable preview address while preserving local development redirects.
- A full hosted staff → customer → private photo → staff smoke pass succeeded with no browser console errors, and all disposable operational records and Storage objects were removed.
- The real first admin is active and its login was verified. Temporary credentials are stored outside Git at `~/.config/vegstod/first-admin.json` with owner-only permissions and should be rotated after first use.
- Vercel is connected to the private GitHub repository `HelgasonF/road`. Feature-branch pushes create previews; `main` is the production branch and must not receive another merge until the release is approved.
- Hosted Supabase blocks public self-signup, requires 10-character letter-and-number passwords, and enforces SSL for external PostgreSQL connections.
- Custom SMTP is still required before using branded hosted invitation/recovery templates. Full commands and operational boundaries are in [`docs/deployment.md`](deployment.md).

## Last completed verification

The current application code was fully checked on 6 September 2026:

- `npm run build` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed all 124 tests across 22 Vitest files.
- `npx supabase test db` passed all 176 assertions across seven pgTAP files.
- `npx supabase db lint --local --schema public` reported no application-schema errors.
- `git diff --check` passed.

The hosted desktop smoke test separately passed staff authentication, HMS lookup, job/customer intake, private Storage upload, and staff photo delivery with no browser console errors. All disposable hosted data was removed afterward.

## Readiness boundary and next work

The local system and hosted desktop workflow are verified, but the current public link is still a preview. The next order is:

1. Repeat the complete customer → dispatch → driver flow on a physical phone through the public HTTPS preview, including native photo selection, without USB forwarding.
2. Configure custom SMTP on the existing Free Supabase project and test invitation/recovery mail.
3. Complete the launch checklist and only then create a production deployment. Upgrade the same Supabase project later when operating requirements justify it.
4. Select accounting, invoicing, payment, refund/credit-note, provider-payment, and reconciliation integrations after the accountant confirms the Icelandic requirements.

Do not treat the preview as a production release or the current billing ledger as a legal invoice issuer or payment processor.
