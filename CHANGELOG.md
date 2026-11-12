# @omnidotdev/signet-app

## 0.2.0

### Minor Changes

- [#51](https://github.com/omnidotdev/signet-app/pull/51) [`ea23ae5`](https://github.com/omnidotdev/signet-app/commit/ea23ae55b0b786421a50cc5865f54a5f56dd6e1a) Thanks [@coopbri](https://github.com/coopbri)! - Forward the signer's origin IP and browser user-agent through the sign and sign-as-me proxies so the Signet API can record them in the audit trail, and require electronic-records (ESIGN / UETA) consent on the "sign it myself" quick-sign path with a consent checkbox that gates the action.

## 0.1.1

### Patch Changes

- [#49](https://github.com/omnidotdev/signet-app/pull/49) [`063908a`](https://github.com/omnidotdev/signet-app/commit/063908a0d522f75804d87f7699bbcca006d439f6) Thanks [@coopbri](https://github.com/coopbri)! - fix(deps): update better-auth to 1.7.7

  Pulls in the upstream security fix released in the 1.7.3 to 1.7.7 range.

## 0.1.0

### Minor Changes

- [#26](https://github.com/omnidotdev/signet-app/pull/26) [`a14e6f0`](https://github.com/omnidotdev/signet-app/commit/a14e6f07b02f22ffc242e258d632b51218c0ce1c) Thanks [@coopbri](https://github.com/coopbri)! - feat(sign): sign documents in-app, with saved signatures

  A signer who is signed in can now sign a document from inside the app: the document detail page shows a Sign action when it is the viewer's turn, opening the full signing experience (`/documents/$id/sign`) without needing the emailed link. The signing capability is resolved server-side through a `sign-as-me` proxy, so the token never reaches the browser.

  Signed-in users get a saved signature reused across their documents and devices (stored via `/api/signet/me/signature`); anonymous signers keep the existing per-device memory. Signature adoption is device-aware: touch devices lead with Draw, desktop leads with Type, and Upload is always last.

- [#34](https://github.com/omnidotdev/signet-app/pull/34) [`f23edba`](https://github.com/omnidotdev/signet-app/commit/f23edba1071aabb3d4d88fda66e7396829b9cee5) Thanks [@coopbri](https://github.com/coopbri)! - feat(documents): add checkbox fields to the editor and signing

  Senders can now place checkbox fields in the field editor (alongside signature, initials, date, and text), and signers can tick them while signing. A ticked box is drawn into the signed PDF. Checkboxes are optional, so they are not part of the required-field tour.

- [#33](https://github.com/omnidotdev/signet-app/pull/33) [`6f64518`](https://github.com/omnidotdev/signet-app/commit/6f64518b97e3a389984fefbbba116729ae934759) Thanks [@coopbri](https://github.com/coopbri)! - feat(documents): edit a pending signer on a sent document

  On a sent document, the owner can now fix a typo in a signer's name or reassign the email of someone who has not yet signed. An "Edit" action on each pending signer opens a dialog; saving a new email reissues the signing link and re-sends it. Signed or declined signers cannot be changed.

- [#36](https://github.com/omnidotdev/signet-app/pull/36) [`a1910bb`](https://github.com/omnidotdev/signet-app/commit/a1910bb40f023913b27353bb91a9fa073295d80c) Thanks [@coopbri](https://github.com/coopbri)! - feat(documents): add dropdown and radio fields to the editor and signing

  Senders can place dropdown and radio fields and edit their choices (a comma-separated Options input shown when the field is selected). Signers pick one choice while signing, and the selection is drawn into the signed PDF.

- [#35](https://github.com/omnidotdev/signet-app/pull/35) [`39ce7a0`](https://github.com/omnidotdev/signet-app/commit/39ce7a01d9d76a11ef1f8bacf713379733a528d5) Thanks [@coopbri](https://github.com/coopbri)! - feat(documents): manage signers from the draft editor

  The draft field editor now has a signer roster: add a signer, edit a signer's name/email, or remove a signer (with confirmation; the last signer cannot be removed). This closes the gap where signers could only be set at upload and never changed afterward.

- [#43](https://github.com/omnidotdev/signet-app/pull/43) [`010e219`](https://github.com/omnidotdev/signet-app/commit/010e219b7cb6b0d8d46ced62f87e0672dadb3c1a) Thanks [@coopbri](https://github.com/coopbri)! - feat(documents): scattered radio groups and fillable dates

  Radio fields are now individual buttons placed anywhere on the page and linked by a Group name (set a Label and Group per button in the editor); selecting one clears the others in its group. Date fields are now editable at signing, defaulting to today, so a signer can enter an effective date or keep the default.

- [#42](https://github.com/omnidotdev/signet-app/pull/42) [`d43c7ec`](https://github.com/omnidotdev/signet-app/commit/d43c7ecab628c780fa2e053327b3d40cbd143ca6) Thanks [@coopbri](https://github.com/coopbri)! - feat(documents): required/optional fields and an auto date-signed field

  The field editor now has a Required toggle per field (signature, initials, text and date default to required; checkbox, dropdown and radio default to optional), and placing a signature automatically adds a "date signed" field above it. In the signer flow, required fields drive the next-field guide and block submitting until they are filled; optional fields can be left blank.

- [#39](https://github.com/omnidotdev/signet-app/pull/39) [`34feb80`](https://github.com/omnidotdev/signet-app/commit/34feb80db4d4c2f167f2fe757bf5b8f79209ed67) Thanks [@coopbri](https://github.com/coopbri)! - feat(documents): add and remove signers on a sent document

  On a sent document, the owner can now add another signer (an "Add signer" button by the Signers heading; they are emailed a link) and remove a still-pending signer (a confirmed, destructive action). Signed or declined signers and the last remaining signer cannot be removed.

- [#41](https://github.com/omnidotdev/signet-app/pull/41) [`0e16dbb`](https://github.com/omnidotdev/signet-app/commit/0e16dbbe06c3c0b8e93f70982b73a7430f2c82d9) Thanks [@coopbri](https://github.com/coopbri)! - feat(signing): color fields per signer and always show the next-field guide

  Signing fields are now tinted in the signer's assigned color (like the field editor and Adobe Sign), which also makes a prefilled date read clearly as filled. The floating next-field guide is now shown whenever a required field is still unfilled (previously it hid once the field was on screen and could be missing on load), so it is always discoverable, and it re-measures its arrow direction after the PDF renders.

### Patch Changes

- [#25](https://github.com/omnidotdev/signet-app/pull/25) [`a5ed9e9`](https://github.com/omnidotdev/signet-app/commit/a5ed9e9e135e01ba0233dad5cd471ca1adb8f953) Thanks [@coopbri](https://github.com/coopbri)! - feat(layout): show an Early Access badge beside the wordmark

  Adds the standard Omni "Early Access" pill to the right of the logo lockup in the header, matching the fleet pattern, while Signet is in early access.

- [#32](https://github.com/omnidotdev/signet-app/pull/32) [`9a51f00`](https://github.com/omnidotdev/signet-app/commit/9a51f003da4492b2bcb60afec2200d04bddcbfee) Thanks [@coopbri](https://github.com/coopbri)! - fix(header): show the Early Access badge on mobile

  The Early Access badge was hidden below the `sm` breakpoint, so it never appeared on mobile. It now shows next to the wordmark at every width (the nav links stay hidden on mobile, so there is room for it).

- [#27](https://github.com/omnidotdev/signet-app/pull/27) [`2602339`](https://github.com/omnidotdev/signet-app/commit/26023391c129676474b07505dfcbb041bbbe1758) Thanks [@coopbri](https://github.com/coopbri)! - chore(assets): add the Signet mark as a hosted PNG for emails

  Adds `public/email-logo.png` (the Signet mark in citrine), served at a stable URL so the notification emails can show the logo. Email clients cannot render the app's inline SVG, so a raster asset is required.

- [#44](https://github.com/omnidotdev/signet-app/pull/44) [`e2cdf1a`](https://github.com/omnidotdev/signet-app/commit/e2cdf1a42561239c0669e448b79b3e8147ce0024) Thanks [@coopbri](https://github.com/coopbri)! - fix(documents): make placed fields reliably draggable and easier to size in the editor

  The document page was a native button wrapping the field boxes, so interactive elements were nested inside a button; on hydration the browser re-parents them, which broke dragging and could misplace fields. The page is now a plain placement surface, so fields drag and reposition correctly. Default field sizes are larger (signatures most of all) and the resize handle is bigger and touch-friendly, so fields are easier to grab, move, and resize.

- [#38](https://github.com/omnidotdev/signet-app/pull/38) [`5d88acc`](https://github.com/omnidotdev/signet-app/commit/5d88acc3f09fe72a94a06599c5625bcd627fa84e) Thanks [@coopbri](https://github.com/coopbri)! - fix(pricing): construct the authz provider lazily so getPrices stops 500ing

  The authz provider throws at construction when `AUTHZ_API_URL` is unset, and it was built eagerly in the shared providers module. The public pricing page's `getPrices` imports that module for `billing`, so it threw an unhandled 500 even though billing itself degrades gracefully. Authz is now constructed on first use, so importing the module no longer requires authorization to be configured.

- [#29](https://github.com/omnidotdev/signet-app/pull/29) [`540137c`](https://github.com/omnidotdev/signet-app/commit/540137c690204af62ea1fa54cd18617bb91d1182) Thanks [@coopbri](https://github.com/coopbri)! - fix(sign): keep the next-field guide out of the way once the field is visible

  The floating next-field guide on the signing page stayed pinned to the bottom at all times, including a permanent "Review fields" button once everything was filled. It is now a true navigation aid: it only appears when the next field that needs input is off screen, fades out once that field scrolls into view, points up or down toward it, and retires entirely when there is nothing left to fill.

- [#37](https://github.com/omnidotdev/signet-app/pull/37) [`48ec5fe`](https://github.com/omnidotdev/signet-app/commit/48ec5fe9a8656b26954bed9966e959f7e035e94a) Thanks [@coopbri](https://github.com/coopbri)! - fix(documents): render the document preview with pdf.js

  The detail-page preview used a raw `<iframe>`, which renders inconsistently and often not at all on mobile. It now renders the PDF to page images with pdf.js (consistent everywhere, with a link fallback), and the heading reads "Signed document" once the document is sealed.

- [#24](https://github.com/omnidotdev/signet-app/pull/24) [`f65cd14`](https://github.com/omnidotdev/signet-app/commit/f65cd148ab932739cc81629b36dad59d96db2d56) Thanks [@coopbri](https://github.com/coopbri)! - fix(documents): allow the in-app document preview to load

  The global `X-Frame-Options: DENY` header blocked the same-origin preview iframe on the document detail page, so the viewer showed "refused to connect". The document-file endpoint now sends `SAMEORIGIN` while every other route keeps `DENY`, so the preview renders and cross-origin framing stays blocked.

- [#28](https://github.com/omnidotdev/signet-app/pull/28) [`a6133ee`](https://github.com/omnidotdev/signet-app/commit/a6133ee3d69af2816aa6d7b0cd542c55d2473461) Thanks [@coopbri](https://github.com/coopbri)! - fix(pricing): render the pricing page when billing is not configured

  `getPrices` threw an unhandled error when billing is disabled. On server render the route loader recovered it, but on client-side navigation the server function surfaced a 500 the loader could not catch, leaving `prices` undefined and crashing the page with "Something went wrong". The fallback to an empty list now lives in the server function itself, so the page always renders the free tier, and the route guards the price list as defense in depth.

- [#31](https://github.com/omnidotdev/signet-app/pull/31) [`f546152`](https://github.com/omnidotdev/signet-app/commit/f5461520046b14a218fad7335e0fc7b8a85acba3) Thanks [@coopbri](https://github.com/coopbri)! - fix(pricing): use the noop billing provider when billing is unconfigured

  When `BILLING_BASE_URL` is unset the app still wired the aether billing provider, so `getPrices` fetched an unset endpoint and threw. On client-side navigation that surfaced as an unhandled 500. Billing now falls back to the noop provider (empty prices, no network) when it is not configured, so the pricing page renders the free tier with no server error.

- [#30](https://github.com/omnidotdev/signet-app/pull/30) [`9ba51a8`](https://github.com/omnidotdev/signet-app/commit/9ba51a850baff20f8c063c44cecd3572f204adbf) Thanks [@coopbri](https://github.com/coopbri)! - fix(documents): keep the rename field from shifting the row

  Choosing "rename" on a document in the list swapped the title for a taller input, which grew the row and nudged everything below it. The display title and the rename field now share a fixed line height, so switching between them no longer shifts the row, and the field stays aligned with the status badge and the row actions.
