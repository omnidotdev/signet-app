---
"@omnidotdev/signet-app": patch
---

fix(sign): keep the next-field guide out of the way once the field is visible

The floating next-field guide on the signing page stayed pinned to the bottom at all times, including a permanent "Review fields" button once everything was filled. It is now a true navigation aid: it only appears when the next field that needs input is off screen, fades out once that field scrolls into view, points up or down toward it, and retires entirely when there is nothing left to fill.
