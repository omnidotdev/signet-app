import { describe, expect, test } from "bun:test";

import { DATE_FORMAT_OPTIONS, formatDate } from "./dateFormat";

describe("formatDate (app mirror of the server formatter)", () => {
  const iso = "2026-11-02";

  test("iso and an absent format keep the plain ISO date", () => {
    expect(formatDate(iso, "iso")).toBe("2026-11-02");
    expect(formatDate(iso, null)).toBe("2026-11-02");
    expect(formatDate(iso, undefined)).toBe("2026-11-02");
  });

  test("us, eu and long match the server rendering", () => {
    expect(formatDate(iso, "us")).toBe("11/02/2026");
    expect(formatDate(iso, "eu")).toBe("02/11/2026");
    expect(formatDate(iso, "long")).toBe("November 2, 2026");
  });

  test("a non-ISO or impossible value is returned unchanged", () => {
    expect(formatDate("on delivery", "us")).toBe("on delivery");
    expect(formatDate("2026-13-40", "long")).toBe("2026-13-40");
  });

  test("every picker option is a real format the formatter understands", () => {
    for (const opt of DATE_FORMAT_OPTIONS) {
      // a known format changes (or deliberately keeps) the ISO date without
      // falling through to the untouched-input path for an unknown format
      expect(typeof formatDate(iso, opt.value)).toBe("string");
    }
    expect(DATE_FORMAT_OPTIONS.map((o) => o.value)).toEqual([
      "iso",
      "us",
      "eu",
      "long",
    ]);
  });
});
