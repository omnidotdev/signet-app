import { describe, expect, test } from "bun:test";

import {
  OPTICAL_SCALE,
  SIGNATURE_FONTS,
  SIGNATURE_FONT_OPTIONS,
  markFontSizeCqh,
  signatureFontStyle,
  textFontSizeCqh,
  toSignatureFont,
} from "./signatureFonts";

describe("signature font styles", () => {
  test("the picker offers every style, classic first", () => {
    expect(SIGNATURE_FONT_OPTIONS.map((o) => o.id)).toEqual([
      ...SIGNATURE_FONTS,
    ]);
    expect(SIGNATURE_FONT_OPTIONS[0]?.id).toBe("classic");
  });

  test("ids match the faces the API embeds", () => {
    // keep in lockstep with signet-api src/lib/fields/signatureFonts.ts
    expect([...SIGNATURE_FONTS]).toEqual([
      "classic",
      "sacramento",
      "dafoe",
      "homemade",
    ]);
  });

  test("an unknown or missing saved style falls back to classic", () => {
    expect(toSignatureFont("dafoe")).toBe("dafoe");
    expect(toSignatureFont("wingdings")).toBe("classic");
    expect(toSignatureFont(null)).toBe("classic");
  });

  test("classic previews as italic sans, handwriting as its own family", () => {
    expect(signatureFontStyle("classic")).toEqual({ fontStyle: "italic" });
    expect(signatureFontStyle("sacramento").fontFamily).toContain(
      "Signet Sacramento",
    );
  });

  test("handwriting previews are optically sized to match the signed PDF", () => {
    // values from signet-api: CLASSIC_X_HEIGHT_EM / the face's x-height
    expect(OPTICAL_SCALE).toEqual({
      sacramento: 1.708,
      dafoe: 1.671,
      homemade: 0.893,
    });
    expect(signatureFontStyle("dafoe").fontSize).toBe("1.671em");
    expect(signatureFontStyle("classic").fontSize).toBeUndefined();
  });

  test("a mark is sized to its field the way the PDF stamps it", () => {
    // a 12pt field draws classic at the full field height
    expect(markFontSizeCqh(12, "classic")).toBeCloseTo(100, 5);
    // a taller field fills three quarters of its height, up to 22pt
    expect(markFontSizeCqh(28, "classic")).toBeCloseTo(75, 5);
    expect(markFontSizeCqh(44, "classic")).toBeCloseTo(50, 5);
    // a handwriting face scales optically but never rises past 1.1 boxes
    expect(markFontSizeCqh(12, "dafoe")).toBeCloseTo(110, 5);
    expect(markFontSizeCqh(40, "homemade")).toBeCloseTo(55 * 0.893, 5);
  });

  test("a date reads at body-copy size in its box", () => {
    expect(textFontSizeCqh(14.3)).toBeCloseTo(78, 5);
    // at most 14pt in a tall box
    expect(textFontSizeCqh(28)).toBeCloseTo(50, 5);
  });
});
