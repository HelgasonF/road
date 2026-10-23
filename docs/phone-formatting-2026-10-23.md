# Phone input and display — 23 October 2026

## Scope and plan

Use `libphonenumber-js` for shared phone parsing, formatting and input validation.
Add an accessible country selector (no default country) and formatting while
typing to customer, job, provider and optional payer phone fields. Display phone
numbers consistently, including pending job titles and driver contact details.
New complete numbers are submitted in E.164. Read existing local, international
and formatted strings without a migration, retaining unrecognizable legacy
values rather than inventing a country or dropping a contact.

Latest preference confirmed during implementation: most customers are visitors,
so new phone fields must start with no country selected. Users select their
number's country code, or paste a full international number to detect it.
Previously saved numbers still infer their country from their existing value;
Icelandic local-number parsing remains only for backward compatibility.

Keep contact-link generation, communication senders, payment processing, job
state transitions, billing locks and database structures unchanged. Retain the
existing server acceptance rules for legacy records; normalize recognized phone
values at the existing input-schema boundaries. Validate new/edited numbers in
the shared input without preventing an untouched legacy field from being saved.

1. Characterize normalization, display, country selection and submitted values.
2. Implement shared helpers/input and use them at existing input/display sites.
3. Verify affected schemas, existing communication/payment behavior, full build,
   types, lint/tests and a narrow/mobile browser view. Record actual results here.

## Completed implementation and verification

Installed `libphonenumber-js` 1.13.15 with the lockfile. Shared `src/lib/phone.ts`
handles display, E.164 normalization and validation; `src/components/phone-input.tsx`
provides the accessible country picker, formatting while typing, international
paste detection, caret handling and English/Icelandic validation messages.
New inputs have no selected country. Saved numbers infer their existing country;
unrecognized legacy values remain available unchanged until edited. New and
edited fields validate using the library; existing server acceptance rules remain
unchanged, with recognized values normalized before existing save actions.

Applied the component to both dispatcher job forms, customer intake, provider
editing and optional payer phones. Updated pending job titles, customer contact
cards, provider lists/access panels, driver identity and phone placeholders in
billing/timeline headings. Displayed phone text remains searchable. The US
example renders as `+1 (702) 219-6679`, with `+17022196679` submitted internally.
The compact selected country label keeps its calling code visible on phones.

- Build, typecheck and lint pass.
- Full Vitest run: **501 passed**, 24 skipped across 61 passing files and four
  opt-in skipped files. No real merchant/account/card tests were enabled.
- Real Chromium fixture using the actual input/contact components passed:
  unselected country validation; Icelandic/US typing; UK and `00`-prefixed paste;
  E.164 form values; middle-of-number cursor editing; English/Icelandic feedback;
  unchanged calling/WhatsApp targets; inherited billing fieldset disabling; and
  no horizontal overflow at **320, 390 and 1280px**.
- Browser fixtures/evidence are ignored under `output/phone-formatting-20261023/`
  and `output/playwright/phone-formatting-390.png`. The initial cursor assertion
  needed to explicitly position the browser cursor before testing an edit; the
  positioned edit passed without an additional application change.
- No database/migration, payment provider, contact-link builder, communication
  sender or operational transition was changed. No hosted records, deployment or
  messages were created. The Git automatic-deployment guard remains unchanged.

These changes are local and uncommitted. The live deployment still serves the
earlier release until an explicit manual deployment.

## Separate location review and subsequent approval

Freyr reported that typing `í Keflavík` produced a generic form error. Read-only
review found that dispatcher typing clears the chosen location while the hidden
label/coordinates submit only a selected result. The server returns field errors,
but the job editor displays only its generic error. The customer description
field did not resolve a place to coordinates; customer intake and paid-draft
validation allowed only GPS/map-pin sources. The existing location
dataset can support typed lookup, but public customer search needs a
token-protected action rather than the staff-only search action.

The proposal was to share typed-location lookup, normalize common phrasing,
resolve an unambiguous place on submission without a map click, explicitly mark
town-level coordinates as approximate, ask for a choice if ambiguous, and show
localized field errors with a summary/focus on the first problem. Supporting
the existing `search` source in the customer validation functions would require
a narrow follow-up migration; no new tables or coordinate-free job model were
proposed. No location behavior changed during that initial review.

Freyr then approved implementation (“ok sounds good do it”). That separate fix
is now complete and tested locally, preserving this phone work. Final combined
checks pass build/types/lint, **534 application tests**, **22 integration tests**
and **379 SQL assertions**, plus customer/dispatcher browser fixtures. Neither
feature is deployed; the location function migration has not been applied to
hosted or the original local database. See the
[location implementation and release record](typed-locations-2026-10-23.md).
