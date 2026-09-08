# Hosted backend improvements — 8 September 2026

This change prepared the existing Supabase backend for more than one authenticated client without changing the customer, dispatcher, or driver workflow.

## Applied changes

1. `storage.objects` now allows an authenticated caller to read an object in the private `job-photos` bucket only when an uploaded `job_photos` row has the exact same `storage_path`. The metadata query retains its staff-or-assigned-driver RLS policy.
2. `jobs`, `job_assignments`, and `operators` were added to `supabase_realtime`. Financial records, staff contact history, customer intake tokens, and photo metadata remain excluded. The web app does not subscribe and continues to refresh through its existing Next.js actions.
3. The versioned `driver-access-v1` Edge Function now owns driver Auth link generation and access disabling. It uses the caller's token for the explicit `is_staff()` check, RLS-scoped operator read, and staff-only RPCs. Its service-role client is used only for `auth.admin` operations. Creation and access-state changes retain compensating rollback behavior.
4. The existing web Server Actions call that function and keep their Icelandic results, revalidation, and WhatsApp handoff unchanged.
5. The authenticated staff/driver gallery requests five-minute signed URLs directly from Storage. The former staff photo API route was removed. The account-free customer photo route remains because its authorization is an intake token rather than a Supabase session.

## Verification

- A clean local database reset applied all 25 migrations.
- All 209 pgTAP assertions passed across nine SQL files.
- The local Edge Function generated a first-party path, rejected a driver JWT with HTTP 403 before an Auth administrator operation, and completed disable/re-enable.
- Hosted migration application and Edge Function deployment completed successfully.
- Hosted tests resolved all three uploaded metadata paths to exact private Storage objects, permitted the assigned driver to create signed URLs, and denied an anonymous caller.
- Hosted function tests returned only the first-party driver path, rejected a driver JWT at the explicit staff boundary, and restored the test driver to active after disable/re-enable.
- TypeScript, ESLint, all 134 Vitest tests, the Next.js production build, and `git diff --check` passed.
- Vercel preview `https://vegstod-9fvhi7fff-freyrs-projects-fad4047a.vercel.app` reached `Ready` and the stable preview alias `https://vegstod.vercel.app` was moved to it.
- The deployed staff browser loaded both retained Alli photos from Supabase Storage signed URLs, produced no application console errors, and generated the normal WhatsApp assignment handoff through the rewired Server Action.

## Compatibility

Driver entry remains the same: dispatch generates the link, opens the prepared WhatsApp message, and the driver taps the Vegstoð link and confirms entry in the browser. Customer links and staff login also remain unchanged. `driver-access-v1` is an additive HTTP contract; future incompatible behavior must use a new function version while installed clients may still call this one.
