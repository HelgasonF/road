# Road / Vegstoð maintenance handoff

Updated: 7 September 2026 (Atlantic/Reykjavik)

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

- Git branch: `chore/vercel-git-connection` (Preview work; `main` remains the production branch).
- Git remote: `origin` → `git@github.com:HelgasonF/road.git`.
- This checkpoint includes the map/address, customer WhatsApp, passwordless driver WhatsApp access, Android-origin, flowchart, hosted Supabase, deployment, and function-permission work completed after `2c3a1fd`.
- Confirm the exact revision with `git log -1 --oneline` and verify `git status --short` is clean before starting another slice.
- The local Supabase Docker stack preserves the current application data and imported Icelandic address register. Restart it with `npx supabase start` if needed.
- No Android device is currently connected through ADB.
- Earlier temporary local and hosted browser-verification data was removed. The completed public-phone audit dataset and the accepted Alli live-demonstration dataset are intentionally retained for owner inspection. Their identifiers are stored outside Git in `~/.config/vegstod/active-phone-audit.json` and `~/.config/vegstod/alli-live-demo.json`; each dataset must be cleaned as a unit afterward.

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

### Passwordless driver WhatsApp access

- Driver access no longer asks for an email, sends an email invitation, or requires a password.
- Dispatch creates a one-time Supabase Auth link from the selected provider's registered phone workflow and then opens a prepared ordinary WhatsApp message.
- A new driver produces a Supabase `signup` token; later links produce `magiclink` tokens. Vegstoð explicitly validates only those two types.
- `/driver/access` requires the driver to press **Opna ökumannsskjá** before redeeming the token, preventing link-preview requests from consuming it.
- The resulting Supabase cookie session uses the existing driver-only RLS policies. Used links fail, and disabling the driver removes an already-authenticated session immediately.
- A real local browser pass verified new and returning links, phone-only presentation, one-time use, and disabling. Temporary Auth users and operator changes were removed afterward.

Relevant files include:

- `src/app/driver/access/page.tsx`
- `src/features/auth/driver-access-form.tsx`
- `src/features/operators/driver-access.ts`
- `src/features/operators/driver-access-panel.tsx`
- `src/features/operators/actions.ts`
- `src/features/jobs/driver-contact-actions.tsx`
- `supabase/migrations/20260906193000_use_whatsapp_driver_access.sql`

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
- All 21 migrations are applied. Hosted reference data contains 139,346 HMS addresses and 2,970 Icelandic place names; the database used about 94 MB at the last check.
- The private `job-photos` bucket and tightened function execution permissions are verified.
- Vercel Preview uses encrypted Supabase variables with `DEMO_MODE=false` and the stable address `https://vegstod.vercel.app`. The same encrypted variables are prepared for Production, but no production deployment is active.
- Supabase Auth Site URL and redirects use the stable preview address while preserving local development redirects.
- The automatic Git Preview passed the full hosted dispatcher → customer → driver → billing workflow. Commit `ba61a50` separately passed the current passwordless WhatsApp driver lifecycle and the provider → job → assignment → WhatsApp handoff → driver acceptance path. All disposable database, Storage, and Auth records were removed; see [`docs/hosted-audit-2026-09-06.md`](hosted-audit-2026-09-06.md) and [`docs/hosted-whatsapp-driver-audit-2026-09-06.md`](hosted-whatsapp-driver-audit-2026-09-06.md).
- The real first admin is active and its simplified testing login was verified. Credentials are stored outside Git at `~/.config/vegstod/first-admin.json` with owner-only permissions; replace the testing password with a unique production password before launch.
- Vercel is connected to the private GitHub repository `HelgasonF/road`. Feature-branch pushes create previews; `main` is the production branch and must not receive another merge until the release is approved.
- Hosted Supabase blocks public self-signup, requires 10-character letter-and-number passwords for staff accounts, and enforces SSL for external PostgreSQL connections.
- Customers and drivers receive their secure Vegstoð links through ordinary WhatsApp. Drivers use passwordless, one-time Supabase Auth links generated by the server-only application client; SMTP is not an operational dependency.
- A real public HTTPS phone pass used installed WhatsApp, GPS, the native photo picker, private-photo display, passwordless driver access, all operational statuses, the staff timeline, and billing handoff. The owner found the detailed status progression too long, so completion is now the primary at-scene action and work/transport tracking is optional. See [`docs/public-phone-audit-2026-09-06.md`](public-phone-audit-2026-09-06.md).
- The hosted project contains five clearly marked presentation providers based in Reykjavík, Hvolsvöllur, Akureyri, Ísafjörður, and Egilsstaðir. They are all available, each has two vehicles and all eleven matching capabilities, and their 190–240 km service circles cover all 2,970 places in the application's hosted Iceland place index. The generic presentation comment has been removed from their notes. Four unassigned jobs in Borgarnes, Blönduós, Höfn, and Vík use separate map positions and produce different verified nearest-driver rankings; each also has its automatic billing record. Their deterministic provider, vehicle, and job IDs are recorded outside Git at `~/.config/vegstod/presentation-network.json` for safe later cleanup.
- A separate real WhatsApp demonstration for Alli completed customer submission with two private photos, assignment to **Alli Dráttarbíll**, passwordless driver activation, and driver acceptance. Alli reported that portrait thumbnails appeared zoomed because the gallery cropped them to a landscape frame; the gallery now shows the complete image. The job was reassigned to **Freyr símapróf 729124** and its fresh driver link was sent to the owner's WhatsApp self-chat for phone inspection. See [`docs/alli-live-demo-2026-09-07.md`](alli-live-demo-2026-09-07.md). Together with the retained physical-phone audit dataset, the hosted dashboard has seven providers and five active jobs.
- Customer intake section 2 now uses a common vehicle-make dropdown with an **Other** free-text fallback, an optional rental-company field, and a required count of people involved. The last two values have dedicated hosted job columns and appear on both the dispatcher and driver screens.
- Customer-link expiry timestamps use an explicit Iceland UTC format shared by the dispatcher panel and public form. This prevents the server/browser locale mismatch found during the hosted form review.

## Last completed verification

The current application code was fully checked on 7 September 2026:

- `npm run build` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed all 126 tests across 25 Vitest files.
- `npx supabase test db` passed all 180 assertions across seven pgTAP files.
- `npx supabase db lint --local --schema public` reported no application-schema errors.
- `git diff --check` passed.

The hosted Git Preview separately passed the complete operational and financial workflow. The current passwordless driver revision also passed new and returning links, one-time rejection, assignment-message auditing, driver acceptance, immediate revocation, and direct Supabase persistence checks. A final physical-phone pass completed the same customer and driver handoffs through real WhatsApp and retained its disposable dataset only for owner inspection.

## Readiness boundary and next work

The local, hosted desktop, and public physical-phone workflows are verified, but the current public link is still a preview. The next order is:

1. Let the owner inspect the retained phone-audit and Alli demonstration jobs, then remove each dataset's Storage objects, job relationships, jobs, driver Auth users, and providers using its owner-only manifest.
2. Replace the simplified administrator testing password with a unique production password before launch, and remove the linked WhatsApp Web device if it should not remain connected.
3. Set up the dedicated Vegstoð number and Meta WhatsApp Business assets, then implement the planned Cloud API messaging, delivery webhooks, driver availability replies, failure handling, and manual fallback documented in `docs/implementation-status.md`.
4. Complete the launch checklist and only then create a production deployment. Upgrade the same Supabase project later when operating requirements justify it.
5. Select accounting, invoicing, payment, refund/credit-note, provider-payment, and reconciliation integrations after the accountant confirms the Icelandic requirements; customer payment links should use the Cloud API with the manual WhatsApp handoff as fallback.

Do not treat the preview as a production release or the current billing ledger as a legal invoice issuer or payment processor.
