---
"@omnidotdev/signet-app": patch
---

fix(documents): render the document preview with pdf.js

The detail-page preview used a raw `<iframe>`, which renders inconsistently and often not at all on mobile. It now renders the PDF to page images with pdf.js (consistent everywhere, with a link fallback), and the heading reads "Signed document" once the document is sealed.
