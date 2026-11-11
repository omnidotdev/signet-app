import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { Price } from "@omnidotdev/providers";

// The billing provider is mocked so we can drive each failure mode. `getPrices`
// is swapped per test via the mutable `getPricesImpl`.
let getPricesImpl: (appName: string) => Promise<unknown>;

mock.module("@/lib/config/app.config", () => ({
  default: { name: "Signet" },
}));

mock.module("@/lib/providers", () => ({
  billing: {
    getPrices: (appName: string) => getPricesImpl(appName),
  },
}));

const { loadAppPrices } = await import("./appPrices");

describe("loadAppPrices", () => {
  beforeEach(() => {
    getPricesImpl = async () => [];
  });

  test("returns the billing prices when billing resolves", async () => {
    const prices = [{ id: "price_1" }, { id: "price_2" }] as unknown as Price[];
    getPricesImpl = async () => prices;
    expect(await loadAppPrices()).toEqual(prices);
  });

  test("passes the app name through to the billing provider", async () => {
    let seen: string | undefined;
    getPricesImpl = async (appName) => {
      seen = appName;
      return [];
    };
    await loadAppPrices();
    expect(seen).toBe("Signet");
  });

  // Production bug: with billing unconfigured the provider would throw an
  // HTTPError that, on client-side navigation, surfaced as an unhandled 500 and
  // crashed the page. The provider is now a noop when unconfigured, but the
  // loader must still degrade if a configured billing service is unreachable.
  test("degrades to an empty list when billing throws", async () => {
    getPricesImpl = async () => {
      throw new Error("HTTPError");
    };
    expect(await loadAppPrices()).toEqual([]);
  });

  test("degrades to an empty list when billing resolves undefined", async () => {
    getPricesImpl = async () => undefined;
    expect(await loadAppPrices()).toEqual([]);
  });
});
