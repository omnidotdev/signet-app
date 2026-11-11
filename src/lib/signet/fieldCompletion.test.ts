import { describe, expect, test } from "bun:test";

import { isFieldIncomplete, isTourField } from "./fieldCompletion";

const ctx = (
  over: Partial<{ textValue: string; hasSignature: boolean }> = {},
) => ({
  textValue: "",
  hasSignature: false,
  ...over,
});

describe("isFieldIncomplete", () => {
  test("signature/initials need an adopted signature", () => {
    expect(isFieldIncomplete({ type: "signature" }, ctx())).toBe(true);
    expect(
      isFieldIncomplete({ type: "signature" }, ctx({ hasSignature: true })),
    ).toBe(false);
    expect(
      isFieldIncomplete({ type: "initials" }, ctx({ hasSignature: true })),
    ).toBe(false);
  });

  test("text/dropdown/radio need a non-empty value", () => {
    for (const type of ["text", "dropdown", "radio"]) {
      expect(isFieldIncomplete({ type }, ctx())).toBe(true);
      expect(isFieldIncomplete({ type }, ctx({ textValue: "  " }))).toBe(true);
      expect(isFieldIncomplete({ type }, ctx({ textValue: "x" }))).toBe(false);
    }
  });

  test("a checkbox must be ticked", () => {
    expect(isFieldIncomplete({ type: "checkbox" }, ctx())).toBe(true);
    expect(
      isFieldIncomplete({ type: "checkbox" }, ctx({ textValue: "true" })),
    ).toBe(false);
  });

  test("a date fills itself", () => {
    expect(isFieldIncomplete({ type: "date" }, ctx())).toBe(false);
  });
});

describe("isTourField", () => {
  test("required non-date fields are in the tour", () => {
    expect(isTourField({ id: "1", type: "signature", required: true })).toBe(
      true,
    );
    expect(isTourField({ id: "2", type: "text" })).toBe(true); // required defaults true
  });

  test("optional and date fields are excluded", () => {
    expect(isTourField({ id: "3", type: "checkbox", required: false })).toBe(
      false,
    );
    expect(isTourField({ id: "4", type: "date", required: true })).toBe(false);
  });
});
