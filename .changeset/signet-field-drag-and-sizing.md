---
"@omnidotdev/signet-app": patch
---

fix(documents): make placed fields reliably draggable and easier to size in the editor

The document page was a native button wrapping the field boxes, so interactive elements were nested inside a button; on hydration the browser re-parents them, which broke dragging and could misplace fields. The page is now a plain placement surface, so fields drag and reposition correctly. Default field sizes are larger (signatures most of all) and the resize handle is bigger and touch-friendly, so fields are easier to grab, move, and resize.
