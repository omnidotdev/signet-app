---
"@omnidotdev/signet-app": patch
---

fix(header): show the Early Access badge on mobile

The Early Access badge was hidden below the `sm` breakpoint, so it never appeared on mobile. It now shows next to the wordmark at every width (the nav links stay hidden on mobile, so there is room for it).
