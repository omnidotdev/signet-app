---
"@omnidotdev/signet-app": patch
---

Fix the signing guide not appearing when a signer's signature is pre-filled
from their name. Because the pre-filled name counted as an adopted signature,
every signature field was treated as already complete, so the floating "go to
your signature" prompt never showed and there was nothing to lead the signer
down to where they sign. The guide now falls back to the signature for review
until the signer has reached it.
