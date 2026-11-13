import { describe, expect, test } from "bun:test";

import {
  guideTargetField,
  isFieldIncomplete,
  isTourField,
} from "./fieldCompletion";

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

describe("guideTargetField", () => {
  const sig = { id: "sig", type: "signature" };
  const txt = { id: "txt", type: "text" };

  test("points at the first field that still needs input", () => {
    const incomplete = (f: { id: string }) => f.id === "txt";
    expect(guideTargetField([sig, txt], incomplete)).toBe(txt);
  });

  test("falls back to the signature when nothing is outstanding (the pre-filled-name case)", () => {
    // a pre-filled signature makes every field "complete", so without the
    // fallback the guide would vanish and never prompt a scroll to the signature
    const nothingIncomplete = () => false;
    expect(guideTargetField([sig, txt], nothingIncomplete)).toBe(sig);
  });

  test("keeps pointing at the signature so the guide returns if the signer scrolls away", () => {
    // the target is persistent: visibility is decided by whether it is on
    // screen, not latched off once seen, so scrolling away from the signature
    // brings the guide back to lead the signer down to it again
    const nothingIncomplete = () => false;
    expect(guideTargetField([sig, txt], nothingIncomplete)).toBe(sig);
  });

  test("returns null when there is no signature to review", () => {
    const nothingIncomplete = () => false;
    expect(guideTargetField([txt], nothingIncomplete)).toBeNull();
  });
});
