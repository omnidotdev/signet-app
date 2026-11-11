/**
 * Shared provider instances.
 *
 * Instantiates authorization and billing providers from @omnidotdev/providers
 * with app-specific configuration from environment variables.
 */

import {
  createAuthzProvider,
  createBillingProvider,
} from "@omnidotdev/providers";

import { AUTHZ_API_URL, BILLING_BASE_URL } from "@/lib/config/env.config";

export const authz = createAuthzProvider({
  apiUrl: AUTHZ_API_URL,
});

// Billing is optional: without a base URL the aether provider would fetch an
// unset endpoint and throw, so fall back to the noop provider (empty prices,
// no network) and let the pricing page render the free tier.
export const billing = BILLING_BASE_URL
  ? createBillingProvider({
      provider: "aether",
      baseUrl: BILLING_BASE_URL,
      appId: "platform",
    })
  : createBillingProvider({ provider: "noop" });
