# Public HTTPS physical-phone audit — 6 September 2026

## Result

The stable Vercel Preview at `https://vegstod.vercel.app` completed the real customer → dispatch → driver → billing-handoff workflow on a physical phone without USB forwarding. The phone used an installed personal WhatsApp account; dispatch used the intended manual Vegstoð handoff and pressed Send in a linked WhatsApp Web session.

The audit used a disposable provider and job created specifically for this pass. Those records are temporarily retained so the owner can inspect the completed job from the staff interface, then they must be removed.

## Customer workflow

1. Dispatch created the customer link in Vegstoð for a real Icelandic mobile number and pressed the prepared WhatsApp handoff.
2. WhatsApp Web opened the self-chat with the English customer instructions and secure Vegstoð URL already filled. Dispatch pressed Send; WhatsApp showed two blue checks.
3. The physical phone opened the link over public HTTPS, used GPS, confirmed the customer and vehicle details, selected a real image through the native phone picker, and submitted the form.
4. Direct hosted Supabase checks found `first_opened_at`, `submitted_at`, `location_source = gps`, one completed private photo record, and one matching object in the private `job-photos` bucket. The uploaded image was 2,308,115 bytes.

## Driver workflow

1. Dispatch assigned the same job to the disposable provider and pressed **Senda úthlutun** in Vegstoð. The server created the driver Auth identity and one-time `signup` URL, and the audited contact event recorded `whatsapp`/`assignment`.
2. The prepared Icelandic assignment message opened in the linked WhatsApp Web session. Dispatch pressed Send and WhatsApp again showed two blue checks.
3. The physical phone opened the one-time URL, pressed **Opna ökumannsskjá**, and reached the assigned job without an email or password.
4. The driver saw the submitted customer information and private photo, accepted the assignment, and advanced the job through `accepted`, `en_route`, `on_scene`, `in_progress`, `transporting`, and `completed`.
5. Direct hosted checks confirmed the assignment acceptance timestamp, all seven job-status history rows, activated driver access, and the provider returning to `available` after completion.

## Staff timeline and billing handoff

- The staff timeline rendered the completed job with 13 merged operational, customer, photo, assignment, contact, and status events.
- Completion created the expected billing case with receivable status `missing_information` and payable status `awaiting_provider_invoice`.
- The owner reported that the detailed driver progression felt too long. The default driver action order was adjusted so **Ljúka verkefni** is primary at the scene; **Skrá vinnu í gangi** and **Skrá flutning** remain available as optional detailed tracking.

## Remaining cleanup and launch work

- Keep the disposable phone-audit records only until the owner finishes inspecting the staff interface, then delete the Storage object, job relationships, job, driver Auth user, and provider.
- Rotate the initial administrator temporary password after the owner signs in successfully.
- Remove the linked WhatsApp Web device after testing if it should not remain connected.
- Complete the operational launch checklist before merging to `main` or creating a production deployment.
