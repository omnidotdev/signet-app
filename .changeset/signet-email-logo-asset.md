---
"@omnidotdev/signet-app": patch
---

chore(assets): add the Signet mark as a hosted PNG for emails

Adds `public/email-logo.png` (the Signet mark in citrine), served at a stable URL so the notification emails can show the logo. Email clients cannot render the app's inline SVG, so a raster asset is required.
