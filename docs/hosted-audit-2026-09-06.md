# Hosted end-to-end audit — 6 September 2026

## Result

The Git-created Vercel Preview at `https://vegstod-r7ebg0ufm-freyrs-projects-fad4047a.vercel.app` passed the complete browser workflow against the hosted Supabase Free project. The audited deployment was built automatically from commit `5611f74` on `chore/vercel-git-connection`.

No production deployment was created and `main` was not changed.

## Workflow exercised

1. The real admin signed in on the new Preview.
2. Dispatch created a temporary Icelandic service provider with capabilities, a base address, service radius, phone number, and vehicle.
3. Dispatch sent a driver invitation to the project owner's Gmail plus-address. The disposable user was activated for the audit and linked to the provider.
4. Dispatch used hosted HMS search to create a high-priority job, matched the qualified provider at 0 km, and generated a 24-hour customer link.
5. An unauthenticated 390 × 844 browser opened the link, confirmed the map location, edited the vehicle details, uploaded a real PNG to private Storage, and submitted the intake form.
6. Dispatch received the changed model, customer description, and private photo. The image loaded at its expected 2517 × 1882 dimensions.
7. Dispatch assigned the provider and its vehicle. The driver signed in at the same mobile viewport, saw only the assigned job, loaded the private photo, and accepted the assignment.
8. The driver moved the job through `accepted`, `en_route`, `on_scene`, `in_progress`, `transporting`, and `completed`. Availability changed to busy on acceptance and back to available on completion.
9. Billing received the completed job. Dispatch recorded payer/provider amounts, issued the payer invoice, approved the provider invoice, recorded both payments independently, and reached `paid`/`paid` (`Fulluppgert`).
10. The unified timeline showed all 17 recorded events: 6 job events, 4 customer events, 2 provider events, and 5 billing events.
11. Dispatch disabled the driver login, and the driver's existing session lost access immediately.

## Authorization and presentation checks

- A driver request for `/billing` redirected to `/driver`.
- A driver request for the staff timeline redirected to `/driver`.
- An anonymous request for the private photo returned HTTP 404.
- An invalid customer token showed the safe unavailable-link page without exposing job data.
- The customer and driver screens had no horizontal overflow at 390 × 844.
- The staff, customer, driver, timeline, and billing flows produced no application-console errors. MapLibre emitted only browser WebGL performance warnings while rendering maps.

## Database evidence and cleanup

Before cleanup, direct hosted assertions found one submitted intake link, one completed private photo, one accepted assignment, seven status-history rows, a completed job, five billing events, and a `paid`/`paid` billing record for 50,000/35,000 ISK. The driver profile was activated and then disabled as expected.

The uploaded object was removed first, followed by the assignment, job and cascading history, provider/vehicle, and disposable Auth user. The final hosted check found:

```text
profiles: 1 (the real admin)
auth users: 1 (the real admin)
operators, vehicles, jobs, assignments: 0
customer links, job photos, billing records/events, contact events: 0
job-photos Storage objects: 0
```

## Automated verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed 124 tests across 22 files.
- `npm run build` passed on Next.js 16.3.1.
- `npx supabase test db` passed 176 assertions across seven pgTAP files.
- `npx supabase db lint --linked --schema public` reported no application-schema errors.
- All 19 local and hosted migrations match, and `npx supabase db push --linked --dry-run` reported the hosted database up to date.

## Remaining release checks

- Repeat the public HTTPS workflow on a physical phone, including its native camera/photo picker and WhatsApp or dialer handoff.
- Configure custom SMTP and test branded invitation and recovery mail with a normal external driver address. The built-in Supabase mailer delivered this audit invitation to the project owner's address, but it is not the operational mail setup.
- Approve the operational launch checklist before merging to `main`, because Vercel treats `main` as the production branch.
