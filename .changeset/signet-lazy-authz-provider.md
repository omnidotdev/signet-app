---
"@omnidotdev/signet-app": patch
---

fix(pricing): construct the authz provider lazily so getPrices stops 500ing

The authz provider throws at construction when `AUTHZ_API_URL` is unset, and it was built eagerly in the shared providers module. The public pricing page's `getPrices` imports that module for `billing`, so it threw an unhandled 500 even though billing itself degrades gracefully. Authz is now constructed on first use, so importing the module no longer requires authorization to be configured.
