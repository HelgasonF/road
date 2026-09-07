# Alli live WhatsApp demonstration — 7 September 2026

## Result

The stable Vercel Preview at `https://vegstod.vercel.app` completed a real customer → dispatch → driver demonstration with Alli through ordinary WhatsApp. The same recipient first acted as the customer and then as the assigned driver. The retained hosted record is intended for the product owner to inspect.

No private customer or driver access token is stored in this document.

## Customer intake

1. Dispatch created a separate job and a 24-hour customer intake link for Alli.
2. The prepared English customer message was sent from the linked WhatsApp Web session. WhatsApp showed delivery to the registered Icelandic mobile number.
3. Alli opened the public Vegstoð page and submitted a map-pin location, registration `BKT88`, vehicle details, the note `Stuck in snow`, and two JPEG photos.
4. Hosted Supabase recorded the submission at `2026-09-07 20:11:37 UTC`. The two completed private uploads were 1,783,932 and 2,824,456 bytes.
5. The dispatcher refreshed immediately and saw the submitted location, vehicle data, note, and both private photo thumbnails on the same job.

## Assignment and driver access

1. A dedicated presentation provider, **Alli Dráttarbíll**, and its recovery vehicle, **Björgunarbíll Alla**, were created in the hosted project with the required capabilities and a 250 km service radius.
2. Matching ranked Alli Dráttarbíll as suitable and 42.8 km from the submitted incident pin. Dispatch deliberately selected that provider and vehicle.
3. Vegstoð created a passwordless one-time driver access link and prepared the Icelandic assignment message for WhatsApp. The assignment handoff was recorded as a staff-initiated `whatsapp`/`assignment` contact event.
4. The linked WhatsApp Web session sent the prepared message and showed two delivery check marks.
5. Alli opened the first-party driver confirmation page, activated the linked driver account, and accepted the assignment. Direct Supabase verification found `jobs.status = accepted`, a current assignment with `accepted_at`, an activated driver identity, and the provider marked `busy`.

## Persistence evidence

The hosted Free Supabase project contains the customer submission, two completed private photo rows, current assignment, driver-access timestamps, assignment contact event, and accepted job state. The identifying record IDs and cleanup metadata remain outside Git in `~/.config/vegstod/alli-live-demo.json`.

The customer link's `first_opened_at` was set when WhatsApp requested the URL for its link preview, before Alli completed the form. This field therefore means the first request to the intake page, not guaranteed human viewing. `submitted_at` and the completed photo rows are the authoritative evidence that the customer finished the intake. The driver's explicit **Opna ökumannsskjá** confirmation continued to protect the one-time Auth token from link-preview consumption.

## Owner photo review

Alli advanced the job to **Á leiðinni** and reported that the portrait photos looked zoomed in on the driver screen. The stored files were intact; the shared gallery forced every thumbnail into a landscape frame with `object-fit: cover`, which cropped the top and bottom of portrait images. The gallery now uses `object-fit: contain` so the whole photo is visible inside each thumbnail, while opening it still returns the original private file.

Commit `5b2cf68` passed lint, typecheck, and a production build, then deployed to the Vercel Preview and was assigned to `https://vegstod.vercel.app`. A 390 × 844 browser check on that stable address showed both portrait photos completely inside their thumbnail frames.

The job was then reassigned to the owner's **Freyr símapróf 729124** driver account and a fresh passwordless assignment link was sent to the owner's WhatsApp self-chat for phone verification. This deliberate reassignment closed Alli's assignment history and returned the job to **Úthlutað** for the new driver.

## Retained demonstration state

- The Alli job is assigned to the owner's test driver so the owner can inspect the same dispatcher and driver experience on a phone.
- The two customer photos remain in private Supabase Storage and are visible only through the existing authorized routes.
- The dedicated Alli provider, vehicle, Auth identity, customer link, photos, both assignment-history rows, audit rows, billing record, and job must be removed together after the demonstration. The existing owner test provider and its Auth identity should remain unless the owner deliberately retires that test account.
- The four unassigned regional presentation jobs remain unchanged for map and matching demonstrations.
