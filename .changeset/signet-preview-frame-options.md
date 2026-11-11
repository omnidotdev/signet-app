---
"@omnidotdev/signet-app": patch
---

fix(documents): allow the in-app document preview to load

The global `X-Frame-Options: DENY` header blocked the same-origin preview iframe on the document detail page, so the viewer showed "refused to connect". The document-file endpoint now sends `SAMEORIGIN` while every other route keeps `DENY`, so the preview renders and cross-origin framing stays blocked.
