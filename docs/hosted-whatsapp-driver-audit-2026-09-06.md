# Hosted WhatsApp driver-access audit — 6 September 2026

## Result

The automatic Vercel Preview built from commit `ba61a50` passed the replacement passwordless driver workflow against the linked Supabase Free project `abpmzqtbllszqqetuubp`. The stable test address `https://vegstod.vercel.app` now points to that Ready deployment; its immutable deployment URL is `https://vegstod-eu7blivuh-freyrs-projects-fad4047a.vercel.app`.

No production deployment was created and `main` was not changed.

## Access lifecycle exercised

1. The real admin signed in and created a temporary provider through the dispatcher UI using a registered phone number, capability, and searched Icelandic base location.
2. The driver-access panel contained no driver email field. It generated a first-party `/driver/access` URL and placed it in a prepared ordinary WhatsApp message.
3. Direct hosted Supabase assertions found the linked Auth user plus both access-link timestamps. The Auth identity used an internal non-routable identifier that was never shown to the driver.
4. A clean browser opened the `signup` link, saw the explicit confirmation screen, pressed **Opna ökumannsskjá**, and reached `/driver`. The driver UI showed the provider phone instead of the internal Auth identifier.
5. A second clean browser tried the same link and received the expected already-used or expired error.
6. Dispatch generated another link for the active driver. Supabase returned a `magiclink` token, and another clean session redeemed it successfully.
7. Dispatch disabled access. Refreshing the authenticated driver session immediately redirected to `/login`.

## Assignment workflow exercised

1. Dispatch created another temporary provider and a high-priority towing job through hosted HMS place search.
2. Direct hosted queries confirmed the provider and job were stored in Supabase, including the requested capability and initial status.
3. Dispatch assigned the job to the matching provider. The assignment and `assigned` job status were confirmed directly in Supabase.
4. The post-assignment action generated a fresh passwordless driver URL and prepared the WhatsApp assignment message. The external message contained the operational area, requested assistance, priority, and secure URL; it did not contain the customer name or phone number.
5. Opening the WhatsApp handoff recorded the expected staff-only `whatsapp`/`assignment` contact event.
6. A 390 × 844 clean driver session redeemed the link, reached `/driver`, saw the assigned customer, location, vehicle, and assistance inside Vegstoð, and had no horizontal overflow.
7. The driver accepted the job. Hosted Supabase showed `jobs.status = accepted` and the assignment acceptance timestamp.

## Migration and cleanup evidence

- Migration `20260906193000_use_whatsapp_driver_access.sql` was applied before deployment. A linked dry run then reported the hosted database up to date.
- `npx supabase db lint --linked --schema public` reported no schema errors.
- The audit removed each disposable assignment before its parent job, deleted both temporary Auth users and providers, and then queried the hosted service directly.
- Final counts were one real admin profile/Auth user and zero operators, vehicles, jobs, assignments, customer links, photos, billing rows/events, contact events, job-status rows, synthetic driver Auth users, and Storage objects.

The earlier complete hosted audit still supplies the customer-photo, complete driver-status, timeline, authorization, and billing evidence. It is recorded in [`hosted-audit-2026-09-06.md`](hosted-audit-2026-09-06.md); this audit covers the driver-access path that replaced its former email invitation.

## Remaining release checks

- Repeat the public HTTPS customer and driver workflow on a physical phone, including its native camera/photo picker and real WhatsApp or dialer handoff.
- Approve the operational launch checklist before merging to `main`, because Vercel treats `main` as the production branch.
