# Customer map error — 14 September 2026

The user noticed an OpenStreetMap error during the earlier WhatsApp end-to-end test. Investigation reproduced **403 Access blocked** inside the customer map's tile image. The earlier operational-flow pass did not establish that this basemap rendered correctly and should not be read as a complete visual pass.

## Cause and reproduction

The private customer page deliberately declares `referrer: "no-referrer"`. The customer's MapLibre raster requests inherited that policy and omitted the `Referer` header. OpenStreetMap requires websites to send a valid referrer and may block requests that suppress it. [OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/)

From the hosted customer page, requested the same visible-area tile twice using the actual browser:

| Request | Referer observed | HTTP status | Image content |
| --- | --- | --- | --- |
| Existing page policy | Empty | 200 | **403 Access blocked** |
| Per-request `strict-origin` | `https://vegstod.vercel.app/` | 200 | Actual Iceland map |

The error was encoded into a valid PNG returned with HTTP 200. Checking HTTP success or console errors alone therefore missed the visible failure. Screenshot comparison: `output/playwright/map-referrer-before-after-2026-09-14.png`.

## Fix

`src/features/customer-intake/customer-location-map.tsx` now applies `referrerPolicy: "strict-origin"` specifically to MapLibre `Tile` requests. This sends the website origin without the customer path, token, or query string. Other requests keep the page's existing `no-referrer` protection. Tile URLs, normal caching behavior, map provider, attribution, GPS logic, and location selection are unchanged.

The installed MapLibre 6.4.1 request implementation supports per-request `referrerPolicy` and passes it through its raster fetch path. The relevant installed Next.js metadata/client-component guides were read before changing code.

## Verification

- The actual local customer form rendered real map tiles in desktop Chrome.
- Browser request inspection recorded 15 map requests, all with exactly `http://localhost:3106/` as their referrer. The generated private customer token was absent from those referrers.
- A separate non-map request from that same page had no referrer; the document metadata remained `no-referrer`.
- On the connected Samsung SM-G990B2, Firefox displayed the actual map, and tapping it updated the pin and showed **Location confirmed**. This used a disposable local request; no WhatsApp message or hosted customer record was created.
- `npm run build`, `npm run typecheck`, and `npm run lint` passed.
- The seven relevant customer-intake/location test files passed: 26 tests. The regression itself was reproduced and verified in the browser with network headers and rendered images, rather than a unit test that merely repeats configuration values.
- `git diff --check` passed.

Screenshots: `output/playwright/customer-map-fixed-2026-09-14.png` and `output/playwright/customer-map-fixed-phone-2026-09-14.png`.

The local environment's configured server key could not read the test intake table. The temporary test server used the active local Supabase secret in its process environment; `.env.local` was not modified. This local credential issue is separate from the reproduced hosted tile error.

## Deployment

A Vercel Preview was built successfully at `https://vegstod-q5bdsv2xh-freyrs-projects-fad4047a.vercel.app`. Its isolated source snapshot contains the previously deployed customer branding plus the five-line map fix. Broader uncommitted staff/driver/billing branding work was preserved locally and excluded. No production deployment, Git push, Meta change, or Supabase deployment was made.

Vercel successfully pointed `https://vegstod.vercel.app` at this preview. The previous alias target was `vegstod-hftj93riw-freyrs-projects-fad4047a.vercel.app`. Browser and phone verification used the local build; the completed Vercel build and successful alias operation confirm publication, not an additional hosted phone retest.

## Cleanup

Removed only the disposable local map-test job after checking its exact ID, label, unsubmitted state, and absence of photos. Follow-up counts were zero for that job, its intake link, and billing row. Closed the test browser, removed the temporary phone forwarding and UI dump, and deleted the private token/log files. Non-secret results remain outside Git in `~/.config/vegstod/map-debug-2026-09-14/evidence.json`. Other local and hosted records were preserved.
