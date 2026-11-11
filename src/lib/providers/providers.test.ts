import { describe, expect, test } from "bun:test";

// The authz provider throws at construction without an apiUrl and used to be
// built eagerly here, so importing this module for `billing` (as the public
// pricing page does) could 500 when authorization was unconfigured. The import
// below must succeed regardless of whether authz is configured, and getAuthz is
// a function that only builds the provider when called. No module mocks: they
// are global in bun and would leak to other test files. Asserting on whether
// getAuthz throws would depend on the environment's AUTHZ_API_URL, so we assert
// only the env-independent structure.
const providers = await import("./index");

describe("providers", () => {
  test("importing the module (for billing) does not throw", () => {
    expect(providers.billing).toBeDefined();
  });

  test("authz is exposed lazily as getAuthz, not constructed at import", () => {
    expect(typeof providers.getAuthz).toBe("function");
  });
});
