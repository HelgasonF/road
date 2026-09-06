# Hosted end-to-end audit — 6 September 2026

> Historical record: this audit exercised the email-based driver invitation that existed in commit `5611f74`. That access path was replaced later on 6 September by passwordless, one-time driver links delivered through the registered WhatsApp number. The mailer observations below explain the old test only; SMTP is no longer a customer or driver release requirement. See [`implementation-status.md`](implementation-status.md) for the current flow.

## Result

The Git-created Vercel Preview at `https://vegstod-r7ebg0ufm-freyrs-projects-fad4047a.vercel.app` passed the complete browser workflow against the hosted Supabase Free project. The audited deployment was built automatically from commit `5611f74` on `chore/vercel-git-connection`.

No production deployment was created and `main` was not changed.

## Repeat persistence proof on the stable URL

A second clean-room run used `https://vegstod.vercel.app`, which was pointed at the Git Preview built from this audit branch. The run created every operational record through the browser first and then queried project `abpmzqtbllszqqetuubp` directly with the hosted Supabase API. This rules out demo data, browser-only state, and a local Supabase instance.

The direct checkpoints found:

- provider `2866448f-61df-4c82-8b47-392fc660f697`, created at `2026-09-06T18:28:47.016248Z` with its address, phone, availability, notes, and towing/tire capabilities;
- vehicle `30f5abcd-32ec-4e73-adb0-3fe0a59923c2`, created at `2026-09-06T18:30:44.926738Z` with registration `PROOF1`, 3,500 kg capacity, and both selected capabilities;
- disposable driver Auth/profile user `57e01023-9fe1-4436-9375-d8157c307429`, linked to the provider with role `driver`;
- job `e7c11826-3ee4-47ce-884f-2d9e4d981614`, created at `2026-09-06T18:34:18.6808Z` with the searched HMS address, high priority, vehicle fields, notes, and required towing capability;
- customer link `a60c53af-de9e-4e70-a0d9-db104dce174d`, opened and submitted through an anonymous mobile browser;
- private photo `a1ee1b8f-126e-45b5-9632-3e979898e490`, with matching 395,621-byte PNG metadata and object in the private `job-photos` bucket;
- assignment `1ffb95be-c539-4dac-b719-9d4c7ad2a002`, connected to the exact provider and vehicle;
- seven consecutive job status rows ending in `completed` at `2026-09-06T18:39:30.263021Z`, with the provider returned to `available`;
- a `paid`/`paid` billing row for 50,000/35,000 ISK and five billing events, ending at `2026-09-06T18:42:47.23302Z`.

The repeated authorization checks redirected the driver away from both `/billing` and the staff timeline, returned HTTP 404 for the private photo without a session, and showed the generic unavailable page for an invalid customer token without exposing the audit job. The staff timeline displayed all 17 expected events: 6 job events, 4 customer events, 2 provider events, and 5 billing events.

The Supabase hosted mailer rate-limited the second invitation attempt with its explicit too-many-emails response. The audit therefore created and confirmed the disposable Auth user with the Supabase admin API, then exercised the browser login and driver authorization path that existed at that revision. This did not affect database, role, or driver-workflow verification. The later WhatsApp access implementation generates Auth links directly and sends no mail.

Immediately before cleanup, direct hosted counts were two profiles/Auth users and exactly one provider, vehicle, job, assignment, customer link, photo, billing row, and Storage folder, plus seven status rows and five billing events. Cleanup removed the object before its metadata and parent records, deleted the disposable Auth user and credentials, and returned the project to the exact baseline shown below.

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
- Deploy and verify the replacement passwordless driver access link through the prepared WhatsApp handoff, including first use, reuse rejection, and immediate access disable.
- Approve the operational launch checklist before merging to `main`, because Vercel treats `main` as the production branch.
