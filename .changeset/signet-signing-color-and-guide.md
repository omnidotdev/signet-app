---
"@omnidotdev/signet-app": minor
---

feat(signing): color fields per signer and always show the next-field guide

Signing fields are now tinted in the signer's assigned color (like the field editor and Adobe Sign), which also makes a prefilled date read clearly as filled. The floating next-field guide is now shown whenever a required field is still unfilled (previously it hid once the field was on screen and could be missing on load), so it is always discoverable, and it re-measures its arrow direction after the PDF renders.
