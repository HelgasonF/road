# Hosted phone-first customer-intake audit — 7 September 2026

The stable Vercel Preview at `https://vegstod.vercel.app`, built from commit `bbc89b4`, passed the new minimum-input customer workflow against the linked Supabase Free project `abpmzqtbllszqqetuubp`.

The browser audit signed in as the existing administrator, pressed **+**, entered only an Icelandic customer phone number, and selected **Búa til og opna WhatsApp**. The test intercepted the external browser handoff, so it did not send a WhatsApp message. The resulting draft contained the correct recipient and an expiring first-party customer link, and that link opened the English customer form.

The disposable customer submission supplied a name, Toyota brand, rental company, two people, confirmed map location, **Tyre assistance**, and a written description. After submission, the dispatcher showed the selected assistance and description, removed the pending-intake state, placed the job on the map, and enabled both assignment controls and ranked provider matching.

The database migration was applied before the deployment. All 22 local and hosted migrations matched afterward. The hosted browser reported no application-console errors; MapLibre emitted four known WebGL rendering warnings.

Direct hosted checks confirmed one customer link, one required-capability row, and one automatic billing row for the temporary job. Cleanup deleted the job and verified that the job, link, capability, and billing records all returned to zero. No retained presentation, public-phone, or Alli demonstration record was changed.

The same working tree passed the complete local verification set: 130 Vitest tests, 200 pgTAP assertions from a clean database rebuild, TypeScript, ESLint, production build, public-schema database lint, and the production dependency audit.
