---
"@omnidotdev/signet-app": minor
---

feat(sign): sign documents in-app, with saved signatures

A signer who is signed in can now sign a document from inside the app: the document detail page shows a Sign action when it is the viewer's turn, opening the full signing experience (`/documents/$id/sign`) without needing the emailed link. The signing capability is resolved server-side through a `sign-as-me` proxy, so the token never reaches the browser.

Signed-in users get a saved signature reused across their documents and devices (stored via `/api/signet/me/signature`); anonymous signers keep the existing per-device memory. Signature adoption is device-aware: touch devices lead with Draw, desktop leads with Type, and Upload is always last.
