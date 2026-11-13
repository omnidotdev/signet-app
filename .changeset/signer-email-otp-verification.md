---
"@omnidotdev/signet-app": minor
---

Add signer identity verification by emailed one-time code. Senders can require
it from the send surface (every signer then needs an email), and a signer is
shown a verification screen that emails them a code to enter before the
document opens. The code screen works in the native signer flow and, server
rendered, without client JavaScript.
