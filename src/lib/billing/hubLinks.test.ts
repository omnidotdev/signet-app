import { afterEach, describe, expect, test } from "bun:test";

import {
  manageSubscriptionUrl,
  resolveBaseUrl,
  upgradePlanUrl,
  workspaceBillingUrl,
} from "./hubLinks";

const HUB = "https://account.omni.dev";
const SIGNET = "https://signet.omni.dev";

const params = (url: string) => Object.fromEntries(new URL(url).searchParams);

describe("resolveBaseUrl", () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  test("uses the configured base URL without a trailing slash", () => {
    expect(resolveBaseUrl(`${SIGNET}/`)).toBe(SIGNET);
  });

  test("falls back to the browser origin when the base URL is empty", () => {
    globalThis.window = {
      location: { origin: SIGNET },
    } as unknown as typeof globalThis.window;

    expect(resolveBaseUrl("")).toBe(SIGNET);
  });

  test("is undefined on the server without a base URL", () => {
    // @ts-expect-error simulate a server render, where there is no window
    globalThis.window = undefined;

    expect(resolveBaseUrl("")).toBeUndefined();
  });
});

describe("workspaceBillingUrl", () => {
  test("points at the workspace's billing page", () => {
    expect(workspaceBillingUrl(`${SIGNET}/`, "acme")).toBe(
      `${SIGNET}/@acme/~/billing`,
    );
  });

  test("is undefined without a base URL", () => {
    expect(workspaceBillingUrl(undefined, "acme")).toBeUndefined();
  });
});

describe("upgradePlanUrl", () => {
  test("buys the plan on the account hub and returns to the workspace's billing", () => {
    const url = upgradePlanUrl(HUB, SIGNET, {
      plan: "pro",
      interval: "month",
      workspaceSlug: "acme",
    });

    expect(url.startsWith(`${HUB}/billing?`)).toBe(true);
    expect(params(url)).toEqual({
      product: "signet",
      plan: "pro",
      interval: "month",
      workspace: "acme",
      return: `${SIGNET}/@acme/~/billing`,
    });
  });

  test("lets the hub ask for the workspace and returns to pricing", () => {
    expect(
      params(upgradePlanUrl(HUB, SIGNET, { plan: "team", interval: "year" })),
    ).toEqual({
      product: "signet",
      plan: "team",
      interval: "year",
      return: `${SIGNET}/pricing`,
    });
  });

  test("opens the hub as the signed-in account", () => {
    expect(
      params(
        upgradePlanUrl(HUB, SIGNET, {
          plan: "pro",
          interval: "month",
          workspaceSlug: "acme",
          loginHint: "user-123",
        }),
      ),
    ).toHaveProperty("login_hint", "user-123");
    expect(
      params(upgradePlanUrl(HUB, SIGNET, { plan: "pro", interval: "month" })),
    ).not.toHaveProperty("login_hint");
  });

  test("is empty when no account hub is configured", () => {
    expect(
      upgradePlanUrl(undefined, SIGNET, { plan: "pro", interval: "month" }),
    ).toBe("");
  });
});

describe("manageSubscriptionUrl", () => {
  test("manages the workspace's plan on the account hub", () => {
    const url = manageSubscriptionUrl(HUB, SIGNET, "acme");

    expect(url.startsWith(`${HUB}/billing?`)).toBe(true);
    expect(params(url)).toEqual({
      product: "signet",
      workspace: "acme",
      manage: "1",
      return: `${SIGNET}/@acme/~/billing`,
    });
  });

  test("opens the hub as the signed-in account", () => {
    expect(
      params(manageSubscriptionUrl(HUB, SIGNET, "acme", "user-123")),
    ).toHaveProperty("login_hint", "user-123");
    expect(
      params(manageSubscriptionUrl(HUB, SIGNET, "acme")),
    ).not.toHaveProperty("login_hint");
  });

  test("is empty when no account hub is configured", () => {
    expect(manageSubscriptionUrl("", SIGNET, "acme")).toBe("");
  });
});
