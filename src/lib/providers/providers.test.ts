import { describe, expect, mock, test } from "bun:test";

// Authorization and billing are both unconfigured, the production case that
// caused the pricing page's getPrices to 500: constructing the authz provider
// without an apiUrl throws, and it used to be built eagerly in this module.
mock.module("@/lib/config/env.config", () => ({
  AUTHZ_API_URL: undefined,
  BILLING_BASE_URL: undefined,
}));

mock.module("@omnidotdev/providers", () => ({
  createBillingProvider: () => ({ getPrices: async () => [] }),
  createAuthzProvider: (config?: { apiUrl?: string }) => {
    if (!config?.apiUrl) {
      throw new Error("WardenAuthzProvider requires apiUrl in config");
    }
    return { checkPermission: async () => true };
  },
}));

const providers = await import("./index");

describe("providers", () => {
  test("billing is available without constructing authz (import does not throw)", () => {
    expect(providers.billing).toBeDefined();
  });

  test("getAuthz throws only when actually used while unconfigured", () => {
    expect(() => providers.getAuthz()).toThrow(/not configured/);
  });
});
