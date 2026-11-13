---
"@omnidotdev/signet-app": minor
---

Multi-signer templates and bulk send. Starting from a template now asks for a
signer for each of its roles ("Signer 1", "Signer 2", ...), so every field lands
with the right person; additional signers can still be added. A new Bulk send
action sends a template to many recipients from a pasted or uploaded CSV (a name
and email per signer role on each line), previewing how many documents will go
out and flagging problem lines before anything is sent.
