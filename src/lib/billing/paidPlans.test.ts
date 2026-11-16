import { describe, expect, test } from "bun:test";

import { hasPaidPlans } from "./paidPlans";

import type { Price } from "@omnidotdev/providers";

const price = (unitAmount: number | null): Price => ({
  id: `price-${unitAmount}`,
  active: true,
  currency: "usd",
  unit_amount: unitAmount,
  recurring: { interval: "month", interval_count: 1 },
  product: {
    id: "product",
    name: "Pro",
    description: null,
    marketing_features: [],
  },
  metadata: { tier: "pro" },
});

describe("hasPaidPlans", () => {
  test("is false with no prices", () => {
    expect(hasPaidPlans([])).toBe(false);
  });

  test("is false when every price is free", () => {
    expect(hasPaidPlans([price(0), price(null)])).toBe(false);
  });

  test("is true when any price costs money", () => {
    expect(hasPaidPlans([price(0), price(900)])).toBe(true);
  });
});
