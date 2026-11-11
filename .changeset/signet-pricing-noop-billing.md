---
"@omnidotdev/signet-app": patch
---

fix(pricing): use the noop billing provider when billing is unconfigured

When `BILLING_BASE_URL` is unset the app still wired the aether billing provider, so `getPrices` fetched an unset endpoint and threw. On client-side navigation that surfaced as an unhandled 500. Billing now falls back to the noop provider (empty prices, no network) when it is not configured, so the pricing page renders the free tier with no server error.
