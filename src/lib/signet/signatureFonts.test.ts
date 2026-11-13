import { describe, expect, test } from "bun:test";

import {
  SIGNATURE_FONTS,
  SIGNATURE_FONT_OPTIONS,
  signatureFontStyle,
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
});
