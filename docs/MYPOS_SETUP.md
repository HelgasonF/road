# myPOS existing REST API v1.1

Hosted release, 21 October 2026: payment collection is enabled on the existing
public site, `https://vegstod.vercel.app`, with the fixed **10,490 ISK** first fee
and dispatcher-entered second payment. The payment migrations and scheduler
extensions are applied to hosted `Road`; credentials are server-only in Vercel
Preview, and the authenticated worker runs every minute using Supabase Cron and
Vault. Local defaults remain disabled. See the [hosted release record](mypos-hosted-release-2026-10-21.md).

23 October update: the audited phone/typed-location release is live. The existing
customer functions now also accept a catalog-resolved `search` location; the
two-payment flow, fixed fee, merchant configuration and worker are unchanged.
No new checkout or charge was used for that release. See the
[phone/location audit](phone-location-release-2026-10-23.md).

The subsequent [live phone audit](live-phone-audit-2026-10-21.md) also passed
against the hosted database and actual scheduled worker. Its two controlled
35 ISK payments bring confirmed testing to **210 ISK across six payments**.
The temporary per-deployment 35 ISK fee was removed afterward; the public site
stays at 10,490 ISK. Native photo upload/removal and a no-charge correction were
verified too. The extra correction link was an audit step, not a required
second details form in the normal customer workflow.

## Decision and scope

21 October 2026: the replacement REST handoff supersedes the previous Gateway implementation. This provider uses the owner's merchant-issued **Client ID and Client Secret**. No Partner Portal registration, Partner/Application IDs, merchant-session token or Gateway request is part of this integration.

The existing backend already had a provider boundary, staff-only payment actions and a pending billing-linked collection migration. Those parts have been reused. The adapter/authentication/configuration have been replaced; legacy numeric status mapping now happens inside the adapter. The service and database consume normalized payment observations, preserving the raw provider code separately. No myPOS package was added.

There are two independent purposes per job: `initial_fee` uses the owner-confirmed fixed **10,490 ISK** amount, and `service` uses the dispatcher's explicitly supplied whole-ISK amount. Neither payment is a deposit or a deduction from the other. Freyr confirmed the owner's first-fee decision on 21 October 2026; both payments remain in ISK.

Existing intake/driver messages, their languages, manual WhatsApp sending, driver assignment/status, prices, invoices and settlement business logic are preserved. After Freyr explicitly requested the full flow, the combined customer checkout, new payment summary text and dispatcher payment panel were added locally. Only verified first-payment completion finalizes the saved customer intake; collection status never completes the operational job or settles the invoice ledger.

## Confirmed payment delivery flow

Implemented and released to the existing online site after Freyr's explicit request on 21 October: service-only draft persistence and paid finalization; the combined customer form action and private payment summary page; dispatcher amount/description/manual WhatsApp controls; authenticated unattended reconciliation and a minute scheduler. Local collection stays disabled by default; the hosted Preview uses the real merchant account and confirmed business fee.

**Confirmed by Freyr on 21 October 2026, with the latest refinement:** keep the first payment in the customer form journey, use one **Pay and submit** button, and require no return visit after checkout. The initial form link needs only one manually sent WhatsApp message. This is the implementation decision:

1. Staff manually send the existing customer intake form link through WhatsApp.
2. The customer fills in their name and the other required details. The entered name is available before final submission; the dispatcher does not need to collect it beforehand and no placeholder is needed.
3. The customer clicks one **Pay and submit** button. The server validates and durably saves the completed form as a private draft, creates or reuses the job's fixed-fee payment request using that entered name, and opens the exact myPOS-hosted payment URL. There is no separate Submit step or payment button on a subsequent thank-you page. Request creation should happen once at this checkout step, not on every name keystroke.
4. After payment, a trusted background process checks myPOS independently of the customer's browser. Only a provider-confirmed Paid result matching the request, merchant/environment, reference, amount and ISK currency can finalize that exact draft as a submitted intake. Finalization must happen once and must still work if the customer closes the checkout and never returns to our site. Failed, cancelled, pending or uncertain payments retain the draft without falsely marking it submitted. Intake submission does not complete the operational job or settle the invoice ledger.
5. After receiving the driver's quote, the dispatcher enters the second payment amount and sends that second payment link.

This decision supersedes both earlier proposals: sending a separate automatic WhatsApp payment message, and submitting the intake first before showing a payment button on its confirmation page. The form approach avoids depending on the unfinished automatic WhatsApp integration for that first payment. The combined button, durable draft storage and automatic finalization are deployed and enabled on the existing online site. The fixed amount is **10,490 ISK**. The controlled payment and full connected-phone tests passed before Freyr authorized this release.

`startCustomerCheckoutAction` validates the active private intake token before provider access. The atomic `prepare_customer_payment_intake` RPC freezes the validated draft and reserves its payment together before the external creation POST. Repeated identical submissions reuse that reservation; changes to a prepared draft are refused. Reloading the original valid link shows its existing payment rather than creating another one. The old Submit action cannot bypass payment or overwrite a frozen draft. A correction link after the original fee is Paid can use the existing unpaid-correction submission path without charging that fee again.

The verified legacy Payment Request contract exposes status reads but does not establish a return URL or payment callback for this flow. The new authenticated worker therefore polls the documented details endpoint independently of the customer browser. It recovers verified Paid rows whose draft was not finalized before a prior worker interruption. `finalize_paid_customer_intake` applies the exact draft once, even if the original link expired after checkout preparation. A revoked link or closed/otherwise submitted job requires staff review instead of silently overwriting details. Payment creation remains a mutation, not a render side effect. Public callers cannot access staff payment actions or assert Paid.

The WhatsApp sender remains staff-authenticated, supports intake/driver templates rather than payment templates, and is paused by default behind `WHATSAPP_API_ENABLED`. The intake UI prepares manual WhatsApp drafts. Nothing in this form payment plan resumes automated WhatsApp sending or changes the existing phone-app account.

## Current application boundary

`src/features/payments/actions.ts` exposes the existing backend contract, with verified staff authorization and input validation on every call:

```ts
await createJobPaymentRequestAction({ jobId, purpose: "initial_fee" });
await createJobPaymentRequestAction({ jobId, purpose: "service", amountIsk });
await getJobPaymentRequestsAction({ jobId });
await verifyJobPaymentRequestAction({ paymentId });
await reconcilePendingJobPaymentsAction();
```

Optional creation arguments remain `language` (the caller's existing two-letter choice) and `expiryDate` (`YYYY-MM-DD`). The provider returns data; it never sends a customer message or changes a language preference. Drivers, pending users and anonymous callers cannot use these staff actions. Application `DEMO_MODE=true` remains a separate read-only preview and refuses the payment actions too.

The first WhatsApp intake message remains `buildCustomerIntakeWhatsAppMessage` in `src/features/customer-intake/customer-contact.ts`. Phone-only creation and replacement links still use it unchanged, with manual sending. When collection is enabled, the form uses `startCustomerCheckoutAction` and one **Pay and submit** button; its displayed amount is server-derived. `getCustomerPaymentSettings` exposes no credentials and fails closed when enabled configuration is incomplete. With collection disabled, the existing intake remains available as before.

The job detail now includes `PaymentPanel`: staff enter the second whole-ISK amount and a customer-visible service description. `createServicePaymentLinkAction` atomically reserves that payment and its summary metadata, then returns `/pay/<random token>`. Only its SHA-256 hash is stored. The summary shows service, vehicle registration, amount and the separate-payment explanation, with English/Icelandic controls and a button opening the exact myPOS URL. No customer information is re-entered. The app prepares a manual WhatsApp draft; staff press Send in WhatsApp. Summary links last 24 hours. Reissuing rotates the old page token while retaining the same payment, amount and description. Paid/closed/uncertain requests cannot create an additional charge.

## Server configuration and credentials

The owner generates REST Client ID/Secret in their existing merchant account under REST API integrations. These are different from Checkout signing keys and Gateway credentials. Their merchant login password is not needed.

Use the server's protected secret environment, starting from these `.env.example` entries with credentials left blank:

```ini
MYPOS_LEGACY_ENABLED=false
MYPOS_REST_ENV=sandbox
MYPOS_REST_CLIENT_ID=
MYPOS_REST_CLIENT_SECRET=
MYPOS_LIVE_PAYMENTS_ENABLED=false
MYPOS_INITIAL_FEE_ISK=10490
MYPOS_COLLECTION_ENABLED=false
PAYMENT_WORKER_SECRET=
```

`MYPOS_LEGACY_ENABLED=true` enables provider access for the staff backend. The only accepted environments are `sandbox` and `production`. Production **request creation** additionally requires explicit owner approval and `MYPOS_LIVE_PAYMENTS_ENABLED=true`; the adapter itself enforces this gate. Production read-only verification does not require enabling creation. Old Gateway flags and credentials are ignored. Hosts cannot be overridden through an arbitrary URL setting, and an instance's credentials stay bound to its environment.

Set `MYPOS_INITIAL_FEE_ISK=10490` for the owner's confirmed **10,490 ISK** first fee. Store the value without a thousands separator: `10.490` is a display format, not the configuration value. This amount is recorded in `.env.example`, local `.env.local` and the live Vercel Preview. Local collection defaults remain disabled; hosted collection is enabled. The second amount is supplied explicitly to its action. Both use the existing integer-ISK representation, with no conversion to EUR or fractional pricing. Server-side persistence also needs the existing `SUPABASE_SECRET_KEY`. No secret belongs in `NEXT_PUBLIC_` variables, ordinary application rows, customer URLs, tests or logs; the scheduler uses encrypted Supabase Vault entries.

Historical currency discussion on 21 October: the owner considered **EUR 75**, and the read-only production account check at **20:11 UTC** returned only **ISK** as eligible. The vendor's legacy Payment Request API supports EUR/USD, but requires the requested currency to be connected to an eligible account. **The owner subsequently chose a fixed 10,490 ISK first fee, as confirmed by Freyr.** That decision supersedes the EUR proposal; the second payment remains a dispatcher-entered ISK amount. No EUR/USD extension or automatic conversion is needed for the agreed flow. No hosted production configuration was changed.

`MYPOS_COLLECTION_ENABLED=true` enables the customer/dispatcher flow only after both payment migrations are applied. They are applied on the hosted site; the original local working database was left unchanged. In enabled mode, incomplete fee/credentials/live-write settings disable checkout rather than silently accepting an unpaid intake. Production creation still requires `MYPOS_LIVE_PAYMENTS_ENABLED=true` separately. Production status reconciliation can continue with that creation flag off.

A private credential template has been prepared outside the repository at `/home/freyr/.config/vegstod/mypos/rest-credentials.json`, owned by the local user with mode `0600`. Its parent directory uses `0700`. Fill it locally with the correct environment and the owner's credentials:

```json
{
  "environment": "production",
  "clientId": "<merchant REST Client ID>",
  "clientSecret": "<merchant REST Client Secret>"
}
```

Then run this **read-only** account check:

```bash
MYPOS_REST_CREDENTIAL_FILE=/home/freyr/.config/vegstod/mypos/rest-credentials.json npm run mypos:check
```

The check rejects credential files in the repository, files belonging to another user and files readable by other users. It forces production writes off and allows only OAuth token acquisition plus the two documented settlement/language GETs. It uses the actual adapter, does not enable the application or change `.env.local`, and prints only environment, eligibility and language/currency codes. Parsing/auth/provider errors do not print credentials, tokens, response bodies, bank identifiers or customer data. A failed ISK eligibility check is a blocker, not permission to change currency. Without `MYPOS_REST_CREDENTIAL_FILE`, this integration test is skipped and no account call occurs.

## Verified legacy contract

The legacy documentation site currently returns errors for many pages. The official overview and individual pages were recovered from archived copies of myPOS's own documentation, then the relevant paths were exercised against the live public sandbox on 21 October. The linked Postman download was unavailable; no guessed lookup URL was implemented.

| Environment | OAuth token endpoint | Transactions base |
| --- | --- | --- |
| Sandbox | `https://sandbox-auth-api.mypos.com/oauth/token` | `https://sandbox-transactions-api.mypos.com/v1.1` |
| Production | `https://auth-api.mypos.com/oauth/token` | `https://transactions-api.mypos.com/v1.1` |

Authentication is `POST /oauth/token`, form body `grant_type=client_credentials`, with HTTP Basic containing the **colon-delimited** Client ID and Secret. The old prose mentions a semicolon, but the code examples use a colon. A colon succeeded in the vendor's sandbox. No alternate format is attempted automatically. The sandbox returned `expires_in` as the string `"86400"`; numeric lifetimes are also accepted. Tokens are held only in server memory for the returned lifetime with a small safety margin. Concurrent calls share token acquisition.

Transactions calls include `Authorization: Bearer <token>`, `API-Key: <merchant Client ID>` and a new UUID `X-Request-ID` per HTTP request. The UUID is a request identifier, not assumed provider idempotency. No Gateway session or partner headers are sent.

| Operation | Exact legacy path | Evidence |
| --- | --- | --- |
| Create a normal request | `POST /online-payments/payment-request` | Vendor page and sandbox HTTP 200 with code/URL |
| Read a request | `GET /online-payments/payment-request/{code}` | Vendor details page and sandbox HTTP 200 with matching code/reference/amount |
| Read settlement eligibility | `GET /online-payments/settlement-data` | Vendor page, sandbox HTTP 200 and successful owner production read |
| Read supported languages | `GET /online-payments/languages` | Vendor page, sandbox HTTP 200 and successful owner production read |

References: [legacy v1.1 overview](https://demo.developers.mypos.eu/en/doc/more_apis/v1_0/54-version-1.1), [OAuth](https://demo.developers.mypos.eu/en/doc/more_apis/v1_0/3-oauth-), [create request](https://demo.developers.mypos.eu/en/doc/more_apis/v1_0/95-create-payment-request), [numeric models](https://demo.developers.mypos.eu/en/doc/more_apis/v1_0/60-models-and-types), [archived vendor details page](https://web.archive.org/web/20250213225751id_/https://demo.developers.mypos.eu/en/doc/more_apis/v1_0/101-payment-request-details), [archived settlement page](https://web.archive.org/web/20250213225751id_/https://demo.developers.mypos.eu/en/doc/more_apis/v1_0/87-settlement-data), [archived language page](https://web.archive.org/web/20250213225751id_/https://demo.developers.mypos.eu/en/doc/more_apis/v1_0/73-languages).

## Request preparation and account requirements

Before reserving a collection slot, `PaymentProvider.prepare` validates the existing customer fields and performs cached read-only capability checks. Missing data, an unsupported language, or unavailable ISK therefore does not consume the job's payment slot. These checks also run inside the adapter before any creation POST.

- **Customer name:** normal legacy requests require `client_name`. The existing staff action supplies `jobs.customer_name`. A missing/blank name raises `payment_customer_name_required` before authentication or persistence. Phone-first intake can have no name yet. The implemented **Pay and submit** flow uses the validated name from the private form draft before final intake submission, so no placeholder name is needed. The vendor documents the field as required text but does not describe a cardholder-name match. Generic placeholder use in production has not been verified.
- **ISK:** the actual settlement endpoint returns `settlement_currency` and an `account` that can be null. Creation requires an ISK entry with a connected non-reserve account; merely listing ISK is insufficient. Missing eligibility raises `payment_isk_unavailable`. The public sandbox listed ISK but had no connected ISK account. The owner's production account passed this eligibility check on 21 October and subsequently accepted the explicitly approved 35 ISK test request described below.
- **Language:** the supplied caller locale is checked against the vendor's language list and is passed through. An unsupported choice raises `payment_language_unsupported`. If no locale exists, the adapter sends the documented empty value for the merchant/provider default. Empty language was accepted in sandbox; no new application language policy is imposed.
- **Expiry:** caller expiry is sent as `expiry_date`, whose behavior was tested in sandbox. The table's `expired_date` spelling conflicts with its examples. The sandbox accepted `expiry_date` and returned the requested date in `expiry_on` at 23:59:59. Production acceptance remains part of the authorized live test.

Creation sends the existing whole-ISK amount, `qr_generated=false`, existing customer name, language/default, optional caller expiry and an opaque `IRA-<payment UUID>` reference as `booking_text`. It does not set customer-facing `reason`, merchant branding/`dba`, `notify_gsm`, SMS delivery or other new business behavior. The adapter retains the exact returned `payment_request_url`, requiring HTTPS on an approved myPOS host matching the environment. It never manufactures a checkout URL.

## Status, persistence and duplicate protection

Legacy details are a direct JSON object with numeric `status`. The adapter normalizes them as follows and retains the original number as `providerStatus` text:

| Legacy code | Normalized state |
| --- | --- |
| 1 | `pending` |
| 2 | `seen` |
| 3 | `failed` |
| 4 | `paid` |
| 5 | `expired` |
| 6 | `cancelled` |
| Other numeric code | `unknown` |

Gateway strings such as `"Paid"` and numeric strings such as `"4"` are rejected. Link delivery/opening is not payment confirmation. Verification requires the correct account/environment/API association and an exact match of provider code, reference, whole-ISK amount and currency. Malformed/different results cannot mark a record paid. Known Paid results are retained against stale or later non-paid reads.

`job_payment_requests` remains a child of the existing `job_billing` ledger, not a replacement ledger. It stores purpose, `sandbox`/`production`, nonsecret merchant Client ID, `provider_api=rest_v1_1`, amount/currency, exact provider code/URL, raw and normalized status and timestamps. The unused Gateway `application_id` field was replaced by a provider API identity before the migration was applied to hosted `Road`. This association prevents an adapter/account change from silently verifying the wrong record. Provider-specific status mapping stays outside SQL so a future adapter can use the same normalized contract.

The payment migrations are `supabase/migrations/20261020223002_add_mypos_payment_requests.sql` and `supabase/migrations/20261021201000_add_customer_payment_checkout.sql`. The latter adds private `customer_payment_intakes`, hashed-token `job_payment_pages`, a worker lease timestamp and four service-only RPCs. Drafts/page tokens cannot be queried or mutated through anonymous or signed-in database clients. They are exposed only through narrowly validated server actions/queries. Both migrations passed isolated-schema tests and were applied to hosted `Road` on 21 October, together with `20261021220248_enable_payment_reconciliation_extensions.sql`. The original local working database was not migrated during that release. Existing hosted operational data was preserved; no database reset was performed.

Staff-only SELECT RLS and server-only mutation RPCs are retained. The unique `(job_id, purpose, environment)` slot is reserved atomically before an external creation POST. Concurrent/repeated clicks cannot create a second request. A known open request can be returned again at the same amount and account. Closed requests, changed amounts/account associations and unresolved attempts fail safely.

Creation POSTs never retry automatically, including after 401, timeout, 429, 5xx, malformed success or failed persistence. Ambiguous outcomes remain reserved for investigation under their original `IRA-<UUID>` reference. Definite post-reservation rejection also retains its slot. Do not clear a slot or create a replacement while the first remote outcome is unresolved. Authentication/permission/provider errors are safe opaque codes; raw bodies/exceptions are not returned or stored. GET may refresh authentication and retry once after 401; 403, rate limiting and other failures are not retried. Every request has a ten-second timeout and rejects redirects.

The original staff reconciliation action remains available. Unattended reconciliation uses `POST /api/internal/payments/reconcile`, authenticated by a server-only `PAYMENT_WORKER_SECRET` of at least 32 characters. It leases at most ten due requests under the exact account/environment/API, updates each lease before the external GET, and uses a twenty-second budget before starting another record. An in-flight authentication/read can extend a pass. Authentication, permission, rate-limit or network failures stop the pass. Overlapping workers cannot claim the same batch. Unfinished Paid drafts remain eligible until submitted or flagged for review. A successful response includes only counts, never customer/payment data.

The dispatcher panel automatically reads the worker's verified database status every 15 seconds while customer intake is pending or a known request is pending/seen/failed/unknown. This discovers the first payment created on the customer's phone even when dispatch opened the job beforehand. When submitted intake arrives through the job refresh, the panel re-reads verified state. It pauses in hidden tabs, refreshes when the tab becomes visible, prevents overlapping reads and stops after intake is complete and no request awaits verification. A failed background read retains known state and retries with a visible notice. It never creates a request or calls myPOS itself. Once the worker records matching Paid, dispatch sees **Greitt** automatically. With the one-minute scheduler enabled, expect polling delay rather than an immediate provider push notification.

Release scheduling uses `supabase/ops/schedule-payment-reconciliation.sql`. It was run on hosted `Road` after Freyr authorized the release; `mypos-payment-reconciliation` runs every minute. The app and scheduler share the worker secret through Vercel and Supabase Vault; no secret belongs in that SQL file. Actual scheduled HTTPS calls returned HTTP 200 with successful reconciliation counts, and an unauthenticated POST returned HTTP 401. The script follows [Supabase's documented Cron/pg_net/Vault pattern](https://supabase.com/docs/guides/functions/schedule-functions). We did not add a Vercel minute cron because [Vercel Hobby permits only daily jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing). The connected-phone test previously proved paid-intake completion without a customer return. No speculative myPOS webhook, automatic WhatsApp message or operational job/invoice transition was added.

## Validation and readiness

Current checkout verification, 21 October:

- The original legacy contract tests were written first and failed against the old Gateway implementation. Those **105 adapter/service/action/store tests** are retained, including outage, permission, rate-limit and duplicate protections. Checkout orchestration tests were added before its implementation, then extended with draft, public-token, page, worker and staff UI checks.
- `npm run build`, `npm run typecheck`, `npm run lint` and `git diff --check` pass. The final full Vitest/coverage run passed **469 tests in 61 files**, including 20 actual adapter/storage/database integration tests, six automatic-display component tests and the two opt-in real PostgreSQL concurrency tests. The owner-account check and interactive real-card session are intentionally skipped in the zero-cost run. Existing messaging, intake, dispatch, driver, billing and timeline regression tests pass.
- Reported payment-source coverage is **88.83% lines / 76.09% branches**. All **363 pgTAP assertions in 15 files** passed in the isolated clone, including **40 provider-storage assertions and 36 checkout assertions**. Earlier schema lint found no errors; no SQL was changed in the latest test slice. Concurrent connections proved that identical form checkouts create one frozen draft and only one creation claim. The repeatable `npm run mypos:test:system -- --full` command creates its own schema-only clone, synthetic fixtures, isolated REST container and HTTP provider simulator, verifies that the working schema/history is unchanged, and removes its temporary database/container. See the [test audit](mypos-test-audit-2026-10-21.md) for exact coverage and remaining vendor acceptance.
- Real browser checks at 390px exercised the actual payment components through a local fixture harness with mocked server actions: service/vehicle/amount summary, dispatcher price/description and WhatsApp draft, frozen resend inputs, and the single **Pay and submit** control with a safe simulated failure. There was no horizontal overflow. Screenshots are under ignored `output/playwright/`. Fixture prices (5,000/27,000 ISK) are test values, not configured business prices. Built Next.js HTTP checks also verified the safe unavailable payment page and HTTP 401 for an unauthenticated worker POST. No customer message or payment request was sent by these checks.
- The vendor's published sandbox account successfully authenticated with colon-delimited Basic, read settlement/language data, created one **EUR 1 sandbox-only protocol request**, and fetched its exact details. No checkout/card payment was performed in that initial experiment; later checkout attempts are recorded below. The application's currency remains strictly ISK; the EUR request was a separate protocol experiment because that public sandbox has no eligible ISK settlement account.
- That live sandbox experiment verified the create/details paths, code and reference preservation, a numeric Pending status, empty/default language acceptance and the `expiry_date` spelling. The private local evidence summary is `~/.config/vegstod/mypos/sandbox-contract-check.json`; it contains no tokens or merchant credentials.
- The read-only checker was also exercised through the actual TypeScript adapter with the vendor's public sandbox account. Authentication and capability parsing succeeded; the eligibility gate rejected that account as expected because its ISK account is null. That expected diagnostic rejection is separate from the passing mocked/local test suite. No production credentials or production account calls were involved.
- On **21 October 2026 at 18:17 UTC**, the owner-credential check passed against **production** through the actual adapter. OAuth authentication succeeded, settlement data confirmed an eligible **ISK** account, and the supported language list included **Icelandic (`is`) and English (`en`)**. Only OAuth token acquisition and the two allowlisted settlement/language GETs ran. No payment request was created, no charge occurred, production writes stayed disabled, and no application environment or database was changed. This verifies production authentication and read access, not Payment Request creation permission or a completed checkout.
- Numeric Paid handling and failure/duplicate protections are covered by mocked/local tests and six actual production checkouts confirmed Paid through the API, including the subsequent hosted phone audit. The connected-phone runs verified both customer and dispatcher journeys, as recorded below and in the [live phone audit](live-phone-audit-2026-10-21.md).

### Zero-cost EUR sandbox checkout follow-up

On 21 October, Freyr confirmed that EUR is acceptable for sandbox testing. EUR can exercise the legacy API protocol and hosted checkout without requiring an ISK sandbox account. The production decision remains fixed at 10,490 ISK for the first fee and a separate dispatcher-entered ISK second payment. The EUR probe stays outside the application's whole-ISK adapter/storage contract; no production currency handling or environment flag was changed.

At **20:45 UTC**, the previously created EUR 1 request was opened in a real browser on the exact returned `https://demo.mypos.eu/pr/...` URL. Its payment page showed the expected amount. All five [published myPOS online test cards](https://developers.mypos.com/online-payments/initial-setup-and-testing/testing-in-sandbox/test-cards) were attempted using fictional holder details, future expiry and a test CVC. Each attempt displayed "Payment with this card is not supported." A subsequent sandbox details GET returned matching code, EUR 1 and numeric **2 (Seen)**, not Paid. The existing request was reused; no additional request, real card, owner production credential, production API call, database migration or customer message was involved.

This verifies the hosted EUR page and actual numeric Seen response, not successful sandbox card acceptance or Paid completion. The remaining sandbox acceptance question is which test-card data and/or account configuration this legacy Payment Request checkout supports. Do not infer compatibility from the separate Web Checkout test-card guide, mark Seen as Paid, substitute a real card, or weaken the application's ISK checks to work around it. Private nonsecret evidence is appended to `~/.config/vegstod/mypos/sandbox-contract-check.json`; the browser screenshot is `output/playwright/mypos-eur-sandbox-test-card-declined.png`. No support message was sent.

Historical follow-up at **21:04 UTC** again returned numeric 2 (Seen). The hosted card-number check returned status=false, and a further SDK example test card also failed. The exact vendor-side acceptance cause remains unresolved. Freyr then authorized his own card as a fallback, with a maximum of **10 checkout attempts**. At that point the total spend and test amounts were unspecified and no production request had been created. The subsequent 35 ISK decision and accepted request are recorded below. Real card details must be entered by Freyr directly on myPOS. See the [current test audit and controlled-test boundary](mypos-test-audit-2026-10-21.md).

### Approved 35 ISK real-card fallback

Freyr subsequently specified **35 ISK per payment**, within **10 attempts / 350 ISK total**. A separate `npm run mypos:test:card` session completed successfully against an isolated schema-only local database; it does not enable normal customer collection or change the 10,490 ISK business fee. Its private localhost page offered two payment purposes (70 ISK total), used the real merchant REST adapter and automatically verified status about once per minute. The session and its disposable database/container are now closed and removed. Freyr enters and confirms the card directly on myPOS. No card number/CVC file, automated card entry or automatic refund is implemented.

The first **35 ISK production payment is confirmed Paid**. At **21:16:04 UTC**, the background worker verified the actual merchant request and automatically submitted the frozen customer draft without a return action. The separate second **35 ISK** service request was prepared at **21:18:06 UTC** and verified as **numeric 4 (Paid) at 21:20:04 UTC**. Both payment purposes, exact references/amounts/ISK and first-intake finalization are now verified against the real merchant. **70 ISK total** was paid. Operational and internal billing states remained unchanged; the interactive acceptance test and all 363 SQL assertions passed. The temporary controller's native-form Origin error was reproduced and fixed in its source with per-session action tokens and 15 passing regression checks; the same session and existing request were retained through successful completion. See the [active test audit](mypos-test-audit-2026-10-21.md#completed-controlled-card-session).

Historical evidence: the prior Gateway scaffolding passed 316 Vitest tests and 324 pgTAP assertions on 20 October before this replacement. That evidence does not establish REST acceptance. The earlier demo Partner Portal application is not used by this provider, and no further Gateway registration or communication is part of this switch.

The complete connected application phone test also passed: the normal dispatcher created the customer link, native WhatsApp delivered it to Freyr's self-chat, and the Firefox phone form supplied GPS and details before opening myPOS. The actual worker confirmed the first 35 ISK payment at **21:45:21 UTC**, finalized the saved intake and updated the untouched staff screen. Dispatch manually entered the separate 35 ISK service amount and description, safely reissued its summary with unchanged provider references, and sent that link through WhatsApp. The worker confirmed the second payment at **21:49:21 UTC**, the staff panel showed both Paid, and the customer summary removed its pay link. Total spend across both test pairs: **140 ISK**, within the 350-ISK approval. The phone run found and fixed first-payment discovery and silent missing-field validation. Temporary test services/tunnels were removed, the original phone display setting restored, and private evidence retained. Normal collection was still disabled at that test cleanup; the subsequent hosted release is recorded above. See the [completed connected-flow audit](mypos-test-audit-2026-10-21.md#connected-payment-results--complete).

Hosted collection is now enabled with `MYPOS_INITIAL_FEE_ISK=10490`, both payment migrations, the scheduler extensions and authenticated minute reconciliation. Production request creation and Paid verification passed with the owner's merchant account; no Partner Portal registration or additional myPOS approval was needed. The business price/currency decision remains a fixed 10,490 ISK first fee and separate dispatcher-entered ISK second payment. Automated WhatsApp sending remains paused. There is no automatic Gateway fallback or currency conversion.

To rerun simultaneous reservation verification, set `MYPOS_TEST_DATABASE_URL` to a separately seeded **local** schema clone named `road_mypos_test_*`. The concurrency test rejects other database names and non-local hosts. Without this variable the database concurrency test is skipped. Do not point it at the working application database.
