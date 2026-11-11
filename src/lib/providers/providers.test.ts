import { describe, expect, test } from "bun:test";

// In the test environment AUTHZ_API_URL and BILLING_BASE_URL are unset, the
// production case that caused the pricing page's getPrices to 500: the authz
// provider throws at construction without an apiUrl, and it used to be built
// eagerly in this module. No module mocks here (they are global in bun and
// would leak to other test files) — the real noop billing provider constructs
// fine, and getAuthz's own guard throws before touching the authz factory.
const providers = await import("./index");

describe("providers", () => {
  test("billing is available without constructing authz (import does not throw)", () => {
    expect(providers.billing).toBeDefined();
  });

  test("getAuthz throws only when actually used while unconfigured", () => {
    expect(() => providers.getAuthz()).toThrow(/not configured/);
  });
});
