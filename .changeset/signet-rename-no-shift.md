---
"@omnidotdev/signet-app": patch
---

fix(documents): keep the rename field from shifting the row

Choosing "rename" on a document in the list swapped the title for a taller input, which grew the row and nudged everything below it. The display title and the rename field now share a fixed line height, so switching between them no longer shifts the row, and the field stays aligned with the status badge and the row actions.
