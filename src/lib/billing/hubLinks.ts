import { hubManageUrl, hubPlanUrl } from "@omnidotdev/providers/react";

import type { HubPlanInterval } from "@omnidotdev/providers/react";

/**
 * Plans are bought and managed on the Omni account hub, the one place every
 * product sells plans and credits. Signet shows its own pricing, but its plan
 * and Manage subscription actions link to the hub, which confirms the plan
 * (names and prices from Aether), runs checkout or the billing portal, and
 * returns here. Each helper is empty when no account hub is configured, so the
 * action is hidden rather than dead
 */

const PRODUCT = "signet";

const trimSlash = (url: string) => url.replace(/\/+$/, "");

/**
 * Signet's absolute base URL for a hub return. Production builds with an empty
 * `VITE_BASE_URL`, so in the browser this falls back to the current origin
 * @param baseUrl - Configured base URL, possibly empty
 */
export const resolveBaseUrl = (
  baseUrl: string | undefined,
): string | undefined => {
  if (baseUrl) return trimSlash(baseUrl);

  return typeof window === "undefined" ? undefined : window.location.origin;
};

/** A workspace's billing page, where the hub returns after a plan action */
export const workspaceBillingUrl = (
  baseUrl: string | undefined,
  workspaceSlug: string,
): string | undefined =>
  baseUrl ? `${trimSlash(baseUrl)}/@${workspaceSlug}/~/billing` : undefined;

/**
 * Buy a Signet plan on the account hub. Without a workspace the hub asks,
 * listing only workspaces the user owns or administers
 * @param accountBaseUrl - Account hub base URL
 * @param baseUrl - Signet's absolute base URL, for the return
 */
export const upgradePlanUrl = (
  accountBaseUrl: string | undefined,
  baseUrl: string | undefined,
  {
    plan,
    interval,
    workspaceSlug,
  }: { plan: string; interval: HubPlanInterval; workspaceSlug?: string },
): string =>
  hubPlanUrl(accountBaseUrl, {
    product: PRODUCT,
    plan,
    interval,
    workspace: workspaceSlug,
    returnUrl: workspaceSlug
      ? workspaceBillingUrl(baseUrl, workspaceSlug)
      : baseUrl
        ? `${trimSlash(baseUrl)}/pricing`
        : undefined,
  });

/**
 * Manage a workspace's Signet plan (change or cancel it, payment method,
 * invoices) on the account hub, returning to the workspace's billing page
 * @param accountBaseUrl - Account hub base URL
 * @param baseUrl - Signet's absolute base URL, for the return
 */
export const manageSubscriptionUrl = (
  accountBaseUrl: string | undefined,
  baseUrl: string | undefined,
  workspaceSlug: string,
): string =>
  hubManageUrl(accountBaseUrl, {
    product: PRODUCT,
    workspace: workspaceSlug,
    returnUrl: workspaceBillingUrl(baseUrl, workspaceSlug),
  });
