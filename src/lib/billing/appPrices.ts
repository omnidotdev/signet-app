import app from "@/lib/config/app.config";
import { billing } from "@/lib/providers";

import type { Price } from "@omnidotdev/providers";

/**
 * Load this app's prices, degrading to an empty list when billing is not
 * configured or unreachable. Billing is an optional integration, so a failure
 * here must never crash the pricing page: it falls back to the free tier.
 *
 * When billing is not configured the provider is a noop that returns an empty
 * list (see the provider wiring), so no network call is made. The try/catch
 * additionally guards a configured but unreachable billing service, since a
 * throw would otherwise surface as an unhandled 500 on client-side navigation
 * where the route loader's catch cannot recover it.
 */
export const loadAppPrices = async (): Promise<Price[]> => {
  try {
    return (await billing.getPrices(app.name)) ?? [];
  } catch (err) {
    console.warn(
      "[pricing] prices unavailable, showing the free tier only",
      err,
    );
    return [];
  }
};
