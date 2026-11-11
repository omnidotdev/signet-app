---
"@omnidotdev/signet-app": minor
---

feat(documents): edit a pending signer on a sent document

On a sent document, the owner can now fix a typo in a signer's name or reassign the email of someone who has not yet signed. An "Edit" action on each pending signer opens a dialog; saving a new email reissues the signing link and re-sends it. Signed or declined signers cannot be changed.
