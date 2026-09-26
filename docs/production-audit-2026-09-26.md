# Production audit and physical phone pass — 26 September 2026

## Fixes deployed

Deployed to `https://vegstod.vercel.app` (alias moved to `vegstod-ifupvwfmt-freyrs-projects-fad4047a.vercel.app`, commit `520d5ca`). The hosted database received `20260926170000_add_request_rate_limits.sql`.

- **Live dispatch board.** Dispatcher and driver workspaces subscribe to Realtime changes on `jobs`, `job_assignments` and `operators` and refresh when the page becomes visible. Realtime had never connected on the hosted app: the hosted publishable key ends with a newline, which fetch tolerates in headers but which broke WebSocket authentication. Supabase environment values are now trimmed.
- **Registration number** is shown to dispatchers (it was stored and shown to drivers only).
- **WhatsApp numbers** other than 7-digit Icelandic or `354…` numbers need `+` or `00`; the app no longer guesses a country code.
- **Customer form:** GPS failures state the real reason next to the GPS button, in the chosen language, and fall back to a network position after a timeout; remaining photos keep uploading after one fails; a typed location description is not overwritten by the pin; the link expiry is labelled; the used/expired pages are fully bilingual.
- **Security headers:** `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, referrer and permissions policies. Script sources are not restricted yet (needs nonces).
- **Rate limits** (Postgres fixed window, fail-open): staff login 10 attempts per 15 minutes per address and per email; customer-link actions and photo route 300 requests per 10 minutes per address.

## Phone pass (Samsung SM-G990B2, live site)

| Flow | Result |
|---|---|
| New job with `91234567` | Refused with Icelandic validation message |
| New job with `+354 6597003` → **Opna WhatsApp** | `com.whatsapp` chat with +354 659 7003, draft with secure link; not sent |
| Customer link in Chrome: GPS, registration, assistance, description, photo, submit | Accepted; reopening shows "details received" |
| Dispatcher open elsewhere during submission | Updated without reload |
| Driver availability and assignment WhatsApp drafts | Correct text; assignment draft contains one-time driver link |
| Driver link → accept → depart → arrive → work → transport → complete | Every status reached the open dispatcher board live within ~2 s; driver returned to available |
| Reusing the driver link in a clean session | Refused: "Aðgangstengillinn er útrunninn eða hefur þegar verið notaður" |
| Navigation button | Opened Google Maps directions to the job |
| Billing: amounts, provider invoice approved and paid, payer set, customer invoice issued and paid | Fully settled; each step confirmed and recorded with user and time |
| Job timeline | 19 events across job, customer, provider and billing |

## Remaining observations

- After saving billing, the selection returns to the first job and the search clears.
- Filtering the dispatcher job list does not move the detail panel to the filtered job.
- A job can be assigned to a provider with no vehicle registered.
- The first load of a new deployment took about 10 s (cold start).

Test data from this pass: jobs `AUDIT TEST - delete me`, `AUDIT LIVE 2` (settled), `AUDIT LIVE 3`, two unsubmitted `+354 6597003` jobs, unsent drafts in the phone's own WhatsApp chat, and `/sdcard/Download/audit-photo.jpg` on the phone.
