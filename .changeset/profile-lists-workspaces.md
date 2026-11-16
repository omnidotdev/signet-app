---
"@omnidotdev/signet-app": patch
---

The profile page loads again. It failed while looking up a plan for the signed-in user, but plans belong to workspaces, so the profile now lists your workspaces with a link to each one's billing. Workspace pages also read their workspace correctly when opened directly.

A workspace's billing page no longer offers an upgrade while there are no paid plans to upgrade to.
