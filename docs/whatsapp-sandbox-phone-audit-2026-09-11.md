# WhatsApp Cloud API sandbox phone audit

Audited: 11 September 2026, 23:48–23:54 Atlantic/Reykjavik.

## Result

The deployed WhatsApp backend completed a live round trip between Vegstoð, Meta's Cloud API sandbox, a physical Android phone, the signed Supabase webhook, and the hosted message ledger.

This pass proves the generic delivery, status, reply-correlation, and idempotency foundation. It used Meta's pre-approved `hello_world` template with the sandbox sender. The three Vegstoð operational templates and their interface buttons still need to be created, approved, configured, and tested before the real business number is moved to Cloud API.

## Environment

- Stable Vegstoð preview: `https://vegstod.vercel.app`
- Supabase project: `abpmzqtbllszqqetuubp`
- Sandbox WABA: `1799725827819599`
- Sandbox Phone Number ID: `1251932438011191`
- Sandbox sender: `+1 555-601-6830`
- Recipient: the owner's verified test number
- Device: Samsung SM-S918B connected over USB with WhatsApp open
- Outbound Edge Function: `whatsapp-send-v1`
- Signed webhook: `whatsapp-webhook-v1`

The production WABA and `+354 853 7704` were not changed or contacted.

## Verified flow

1. A real staff session invoked `whatsapp-send-v1` with purpose `test`, a fresh UUID idempotency key, and the verified test recipient.
2. The function returned HTTP 200 with one accepted outbound ledger record. Meta delivered the fresh `Hello World` notification to the connected phone at 23:48.
3. The hosted webhook recorded `sent` and `read` status events with no error code. The outbound record reached `read` with `attempt_count = 1`.
4. The phone sent plain text `Laus`. The webhook stored it once with classification `available`. It had no context ID, so it remained unlinked, as expected for a plain reply to a purpose-`test` message.
5. The phone used WhatsApp's quoted-reply gesture on the exact template message and sent `Ekki laus`. The webhook stored it once with classification `unavailable`, preserved Meta's context message ID, and linked it to the exact outbound ledger record.
6. Repeating the identical function request with the same idempotency key returned HTTP 200 with `deduplicated: true`, the same outbound and Meta message IDs, and current state `read`. The ledger still contained one row, `attempt_count` remained `1`, and the phone received no second message.
7. Reusing the same idempotency key with a different recipient produced HTTP 409 `idempotency_conflict` before provider delivery.

## Evidence boundary

The pass verifies a real Meta provider request, a real physical-phone delivery, signed webhook ingestion, normalized delivery events, free-text classification, exact quoted-reply correlation, and duplicate-send prevention in the hosted environment.

It does not yet verify:

- the customer-intake template and secure customer link;
- the driver-availability template against a real job/operator pair;
- the assignment/access template and one-time driver login;
- provider rejection and ambiguous network failure against Meta;
- dispatcher UI status rendering, reply review, opt-out controls, or automatic-to-manual fallback;
- direct registration or sending from the production number.

The safe local manifest for this test is stored outside Git at `~/.config/vegstod/whatsapp-api-sandbox-test.json`. It contains identifiers and timestamps but no access token or customer content. Temporary phone screenshots were inspected locally and removed rather than committed.

## Follow-up on 12 September

The operational interface, dynamic secure-link buttons, candidate reply display, staff delivery/reply timeline, and signed STOP/START preference guard were subsequently implemented and deployed. Local and hosted fallback passes succeeded while the three operational templates remained pending Meta review. The disposable hosted failure and preference-check records were removed. The evidence boundary above remains the boundary of the 11 September physical-phone pass itself; the next phone pass starts when Meta approves the templates.
