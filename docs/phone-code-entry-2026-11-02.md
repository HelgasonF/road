# Direct calling-code entry — 2 November 2026

## Scope

Freyr asked to investigate four owner reports, then explicitly requested one fix
at a time and selected **1: enter a country calling code directly**. Only this
phone-input change is implemented in this checkpoint. It is local and unreleased.

The shared phone input now accepts `+44`, `44` and `0044` in its country-code
box. Users can still choose a country through the native dropdown arrow or
paste a complete international number into the phone-number box. New fields
have **no default country or calling code**. Picking, typing and pasting keep
the code box and country selector synchronized.

The existing `libphonenumber-js` metadata validates complete calling codes.
Partial or invalid codes do not fall back to a previously chosen country.
National prefixes are handled by the library; for example, UK `020 7946 0958`
becomes `+442079460958`. Significant Italian leading zeroes, shared calling
codes and non-geographic codes retain their correct E.164 values. English and
Icelandic helper/error messages explain direct entry. Only the existing hidden
phone field is serialized; the new editable code field has no submitted name.

Existing numbers, unchanged legacy contacts, optional fields, disabled billing
fieldsets, as-you-type formatting, caret editing and contact destinations are
preserved. The change requires no dependency, database, payment or communication
integration changes. It applies wherever the shared `PhoneInput` is already used.

## Verification

The initial new direct-entry tests failed because the code box did not exist;
the implementation then passed them. The first UK test fixture was replaced
with the existing valid example because the library intentionally rejects the
reserved mobile sample used initially. Phone validation was not weakened.

- Production build, typecheck and lint pass.
- Final full local suite: **599 passed, 27 opt-in skipped**, across 72 passing
  files and five skipped files. All **28 phone-component tests** pass, including
  13 new direct-entry, synchronization, validation and legacy regressions.
- Real Chromium used the actual phone/contact components and application CSS in
  a local fixture without credentials or server actions. It verified character
  by character `+44`, `44` and `0044` entry; native picker synchronization;
  complete-number paste; E.164 form submission; invalid-code feedback in both
  languages; code re-entry; caret editing; unchanged legacy numbers; inherited
  billing locks; unchanged call/WhatsApp targets; keyboard tab order and pointer
  access to the dropdown arrow. No horizontal overflow at **320, 390, 1280px**;
  no browser errors or warnings during the acceptance run.
- The fixture initially lacked a favicon and generated a fixture-only 404;
  adding a local data favicon removed it before the acceptance run. No
  application error was involved.
- Ignored evidence is under `output/phone-code-20261102/` and
  `output/playwright/phone-code-20261102-390.png`.

The pre-existing unfinished editor/map changes remain separate:
`src/features/jobs/editor.tsx`, its test, `address-search-field.tsx` and the
untracked address-map test. The full local checks include that existing working
tree. This checkpoint changes only the shared phone component, its test, CSS and
documentation. No commit, push or deployment was performed for this fix.

## Remaining owner reports — investigation only

Subsequent checkpoint: Freyr selected issue 2 next; it is now implemented and
verified locally. See the [SMS record](sms-handoff-2026-11-02.md). Issue 3 was then
completed locally; see the [destination record](vehicle-destination-2026-11-02.md).
Issue 4 was later completed locally; see the
[replacement record](service-payment-replacement-2026-11-02.md).
The findings below describe the earlier investigation.

- **2: SMS sharing.** The existing customer URL is channel-independent. There is
  no SMS-draft button yet. The hosted records show that the 05:51:20 link
  revocation coincided exactly with creation of its replacement; the same
  happened at 05:54:43. Creating a new customer link revokes the previous active
  link. The timeline labels every revocation as a system event and does not
  explain replacement. Switching sharing channels should reuse the generated
  link. Raw tokens are only available in the current share panel; the database
  stores hashes, so retrieval after refresh needs an explicit design decision.
  Freyr's connected phone is available for a later SMS-draft test.
- **3: vehicle destination.** The current form captures pickup location and
  description only. Add an optional dedicated destination field in both
  languages, accept text without requiring a map pin, and carry it through
  saved payment drafts, submission/corrections, dispatcher editing and provider
  details. Keep pickup coordinates separate. This needs a backwards-compatible
  nullable field and the corresponding server/database contracts.
- **4: replace the second payment.** Freyr clarified that editing the amount
  and sending the replacement must happen entirely in the IRA application.
  The current UI disables amount/description after creation; service-page
  regeneration rotates only the IRA page token and reuses the same provider
  payment. The database reserves one row per job/purpose/environment and
  rejects changed amounts/descriptions. No cancellation/replacement action
  exists. A replacement feature must preserve history and the initial fee,
  invalidate the old IRA page, and account for a customer who already opened
  the old provider checkout. Invalidating the IRA page alone does not revoke
  that checkout. The documented [legacy create operation](https://demo.developers.mypos.eu/en/doc/more_apis/v1_0/95-create-payment-request)
  and [official endpoint mapping](https://developers.mypos.com/guides/api-migration-guide)
  distinguish Payment Requests from editable/deletable Payment Links. No
  documented cancellation/update operation for this Payment Request API was
  found during this review. This is an unresolved integration detail for the
  eventual internal replacement flow, not a decision to require staff to manage
  prices in myPOS. No live request was cancelled, changed or created.
