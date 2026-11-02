# Customer SMS handoff — 2 November 2026

## Scope and status

After completing calling-code entry as issue 1, Freyr selected **issue 2** and
provided the connected phone for testing. He explicitly requested support for
both **iPhone and Android**. This change was verified locally on both physical
phones and is now **committed, deployed and live-tested** with the other owner
fixes. See the [release record](owner-followup-release-2026-11-02.md),
[destination record](vehicle-destination-2026-11-02.md) and
[replacement record](service-payment-replacement-2026-11-02.md). Native phone
acceptance below preceded deployment; hosted checks verified the same generated
messages without sending SMS or WhatsApp.

The existing customer sharing panels now offer **Opna SMS** beside **Opna
WhatsApp** and **Afrita skilaboð**. This covers quick job creation, the existing
job's customer/correction link and prepared service-payment links. The quick
creation button now says **Búa til viðskiptavinatengil**, since the URL works
through either channel. The same full prepared message and private URL are
used for both apps.

Opening SMS only opens the device's messaging composer. Staff check the sender
selected in that app and the recipient, then press Send themselves. It neither
generates/revokes another customer link nor creates another payment. The system
cannot establish that a manual SMS was sent or delivered. The copy/preview
fallback remains available for computers without an SMS handler. Driver
availability, driver assignment and provider onboarding retain their existing
WhatsApp-only behavior and audit callbacks.

The earlier live incident at 05:51 was investigated during issue 1. A replacement
customer link was created at exactly the old link's revocation timestamp, with
another replacement at 05:54. Sending a URL by SMS does not revoke it. Sharing
guidance now explains that channels reuse the same link and that generating a
replacement invalidates the old link. Raw tokens still exist only in the
current share panel; this change does not add raw-token storage or retrieval
after refresh. An already copied message can be resent unchanged while its
link remains active.

## Implementation

- `src/lib/sms-links.ts` uses the existing `libphonenumber-js` normalization to
  produce one E.164 recipient. It rejects ambiguous/invalid recipients and
  additional addresses. Complete message text, Unicode, newlines and private
  URLs are percent-encoded without query-parameter corruption.
- Standard/Android links use `sms:+number?body=...`. The URI/body design follows
  [RFC 5724](https://www.rfc-editor.org/rfc/rfc5724.html).
- iPhone/iPad use the `&body=` compatibility form. Desktop-mode iPad is detected
  by its Mac user agent plus multiple touch points. Platform detection runs
  only during the click, keeping server/client initial markup identical.
  Apple's [archived SMS documentation](https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/SMSLinks/SMSLinks.html)
  does not document message-body prefill. The physical iPhone 11 Pro check
  below verifies this compatibility form on the available iPhone; native iPad
  remains untested. The copy fallback works if a device does not prefill the
  body or cannot open SMS.
- `allowSms` is opt-in on the existing manual message component; it defaults
  to false. SMS does not call the WhatsApp-only `onOpen` callback or claim a
  send/delivery event.
- Only client sharing UI/helpers/tests/docs change. No database, server action,
  payment provider, payment pricing/locks, WhatsApp API configuration or job
  workflow changed. No dependency was added.

## Verified results

- Production build, typecheck and lint pass.
- Full local suite: **621 passed, 27 opt-in skipped** across 74 passing files
  and five skipped files. The suite includes the pre-existing unrelated local
  map/editor edits; those edits remain separate from this change.
- **22 new tests** cover recipient normalization, URI encoding/injection
  boundaries, both body formats, iPhone/iPad/desktop-mode iPad/Android detection,
  stable hydration, copy fallback, driver opt-in boundaries and reuse of the
  exact original link/message with no creation/revocation/payment action on
  SMS click. Quick intake and payment-panel tests additionally check their new
  SMS option while preserving existing behavior.
- Chromium checks using the actual customer-link panel and manual sharing
  component verified one mocked link creation, zero revocations, the same
  message/URL, copy fallback, unchanged driver actions and no overflow at
  **320, 390 and 1280px**. Fresh mobile contexts cover Android, iPhone and
  desktop-mode iPad formats. No application-console errors or warnings.
  The initial iPad emulation reported only one touch point; modeling the real
  iPad's five touch points corrected the harness without changing application
  detection.
- **Physical Samsung SM-G990B2, Android 16:** the actual **Opna SMS** button in
  a locally served customer-panel fixture opened Samsung Messages. A native
  UI dump confirmed the exact single fictional recipient and all **370
  characters** of the prepared message, including the same synthetic local
  customer URL. Mock counters remained **one create / zero revocations**.
  The first background-tab attempt did not open the native composer; explicitly
  activating the owned Chrome tab verified the visible user-gesture handoff.
- **Physical iPhone 11 Pro, iOS 26.6.2:** SSH to the Mac mini succeeded and the
  exact paired phone was selected. Safari initially rejected automation because
  Web Inspector was disabled; after Freyr enabled the settings, a fresh driver
  reported **could not connect to device**. CoreDevice confirmed the phone was
  unlocked, pairing valid and developer image usable. Direct Safari launch
  succeeded, with HTTP 200 recorded for the fixture page and both assets. Freyr
  then tapped **Búa til tengil → Opna SMS** on the actual phone and confirmed
  **“yes it works”** in response to checking the recipient, prepared text and
  link. This is **user-observed native iPhone acceptance**, not an automated
  WebDriver/native-text-extraction pass. No valid native WebDriver session was
  created; no application change was needed after that manual check.
- This was an **unsent draft test** with a fictional UK recipient. No real
  customer was messaged; no carrier delivery or incoming customer tap was
  tested. No hosted job/link/payment was created and no card was charged.

Ignored evidence is under `output/sms-handoff-20261102/`, with a screenshot at
`output/playwright/sms-handoff-20261102-390.png`. The Android journey was repeated
visibly after Freyr missed the first brief run, and he confirmed it opened.
Both owned Android drafts were cleared and the empty composer verified; the
remaining recorded demo tab had already been closed when cleanup checked its
exact ID. The first two owned fixture tabs were closed earlier. The desktop
test session, ADB mappings and local fixture server have been removed. Local
ports 3194/3195 and Mac ports 3194/3196/3198 have no remaining listeners.
The two failed owned Safari drivers on 3196/3198 are stopped. The Mac static
server on `192.168.11.93:3194` and exclusively owned fixture directory
`/tmp/road-sms-ios-20261102-ebif34nj` were removed after the iPhone confirmation,
using the ownership marker and exact file manifest. No unrelated Mac
app/test/simulator was changed. Freyr can dismiss the iPhone's unsent test draft;
the agent could not control native Messages and did not alter its data directly.

The existing unrelated editor/address-map edits are preserved, as is the local
issue-1 implementation. The SMS changes in `editor.tsx`/its test are limited to
the quick-flow labels, opt-in sharing prop and SMS assertions; the pre-existing
map mocks, error text, map-open setting and map behavior are not part of this
fix. A later release must isolate the requested fixes from that unfinished work.
