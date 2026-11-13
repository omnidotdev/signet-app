import type { CSSProperties } from "react";

/**
 * Handwriting styles for a typed signature. The ids match the API, which embeds
 * the same faces into the signed PDF; the families are self-hosted in
 * globals.css. "classic" is the long-standing oblique sans style.
 */
export const SIGNATURE_FONTS = [
  "classic",
  "sacramento",
  "dafoe",
  "homemade",
] as const;
export type SignatureFont = (typeof SIGNATURE_FONTS)[number];

export const SIGNATURE_FONT_OPTIONS: {
  id: SignatureFont;
  label: string;
}[] = [
  { id: "classic", label: "Classic" },
  { id: "sacramento", label: "Flowing" },
  { id: "dafoe", label: "Bold script" },
  { id: "homemade", label: "Handwritten" },
];

/**
 * Size multiplier that makes each face's lowercase as tall as the classic
 * signature's (the classic x-height divided by the face's own x-height). These
 * match the factors the API derives from the same font files when it stamps the
 * PDF, so the preview and the signed document agree
 */
export const OPTICAL_SCALE: Record<
  Exclude<SignatureFont, "classic">,
  number
> = {
  sacramento: 1.708,
  dafoe: 1.671,
  homemade: 0.893,
};

const FAMILIES: Record<Exclude<SignatureFont, "classic">, string> = {
  sacramento: '"Signet Sacramento", cursive',
  dafoe: '"Signet Mr Dafoe", cursive',
  homemade: '"Signet Homemade Apple", cursive',
};

export const isSignatureFont = (value: unknown): value is SignatureFont =>
  typeof value === "string" &&
  (SIGNATURE_FONTS as readonly string[]).includes(value);

/** A stored or saved style, falling back to classic for anything unknown */
export const toSignatureFont = (value: unknown): SignatureFont =>
  isSignatureFont(value) ? value : "classic";

/**
 * Inline style that previews a typed signature in its handwriting face. Classic
 * keeps the existing italic sans look, so nothing is overridden for it
 */
export const signatureFontStyle = (font: SignatureFont): CSSProperties =>
  font === "classic"
    ? { fontStyle: "italic" }
    : {
        fontFamily: FAMILIES[font],
        fontStyle: "normal",
        fontWeight: 400,
        fontSize: `${OPTICAL_SCALE[font]}em`,
      };

/** The optical size multiplier for a style (1 for the classic face) */
export const opticalScale = (font: SignatureFont): number =>
  font === "classic" ? 1 : OPTICAL_SCALE[font];

/**
 * Font size for a typed mark inside a field box, as a share of the box height
 * (CSS `cqh`), matching how the API stamps it: the classic face at the field
 * height capped at 14pt, a handwriting face scaled by its optical factor
 */
export const markFontSizeCqh = (
  fieldHeightPt: number,
  font: SignatureFont,
): number =>
  (Math.min(fieldHeightPt, 14) / fieldHeightPt) * 100 * opticalScale(font);
