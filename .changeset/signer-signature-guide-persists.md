---
"@omnidotdev/signet-app": patch
---

Keep the signing guide reachable after the signer first sees their signature.
The floating "go to your signature" prompt previously retired for good the
moment the signature scrolled into view, so scrolling back up left nothing to
lead the signer down to where they sign. The guide is now persistent and driven
purely by whether its target is on screen: it hides while the next field or the
signature is in view and reappears whenever the signer scrolls away from it.
