import { createServerFn } from "@tanstack/react-start";

import { loadAppPrices } from "@/lib/billing/appPrices";

import type { Price } from "@omnidotdev/providers";

/**
 * Fetch all prices for this app, filtered by app name metadata and sorted by
 * unit amount (ascending). Degrades to an empty list when billing is not
 * configured, so the pricing page always renders (free tier only).
 */
export const getPrices = createServerFn().handler(
  (): Promise<Price[]> => loadAppPrices(),
);
