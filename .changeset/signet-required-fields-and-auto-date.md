---
"@omnidotdev/signet-app": minor
---

feat(documents): required/optional fields and an auto date-signed field

The field editor now has a Required toggle per field (signature, initials, text and date default to required; checkbox, dropdown and radio default to optional), and placing a signature automatically adds a "date signed" field above it. In the signer flow, required fields drive the next-field guide and block submitting until they are filled; optional fields can be left blank.
