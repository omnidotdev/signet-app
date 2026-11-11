---
"@omnidotdev/signet-app": patch
---

fix(pricing): render the pricing page when billing is not configured

`getPrices` threw an unhandled error when billing is disabled. On server render the route loader recovered it, but on client-side navigation the server function surfaced a 500 the loader could not catch, leaving `prices` undefined and crashing the page with "Something went wrong". The fallback to an empty list now lives in the server function itself, so the page always renders the free tier, and the route guards the price list as defense in depth.
