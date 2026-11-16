import type { Price } from "@omnidotdev/providers";

/**
 * Whether the product sells any paid plan, judged from its Aether price list.
 * A product with only the free tier has nothing to upgrade to, so upgrade
 * actions are hidden rather than pointing at a pricing page with one card
 * @param prices - The app's prices, as the pricing page loads them
 */
export const hasPaidPlans = (prices: Price[]): boolean =>
  prices.some((price) => (price.unit_amount ?? 0) > 0);
