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

import type { AuthzProvider } from "@omnidotdev/providers/authz";

// The authz provider has no noop variant and throws at construction without an
// apiUrl, so build it lazily. Otherwise merely importing this module for
// `billing` (e.g. from the public pricing page) would throw when authorization
// is not configured. It is only constructed when a permission check runs.
let authzInstance: AuthzProvider | null = null;
export const getAuthz = (): AuthzProvider => {
  if (!AUTHZ_API_URL) {
    throw new Error("Authorization is not configured (AUTHZ_API_URL is unset)");
  }
  if (!authzInstance) {
    authzInstance = createAuthzProvider({ apiUrl: AUTHZ_API_URL });
  }
  return authzInstance;
};

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
