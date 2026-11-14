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
 * Point size of a mark in a box `heightPt` tall, mirroring the API's
 * `markSize` (lib/fields/stamp.ts): large enough to fill the box, never smaller
 * than the single-line size shorter boxes used. Keep the two in lockstep
 */
export const markSizePt = (heightPt: number): number =>
  Math.max(Math.min(heightPt, 14), Math.min(heightPt * 0.75, 22));

/** A handwriting face may rise at most this many box heights (API mirror) */
const HANDWRITING_MAX_HEIGHT = 1.1;

/**
 * Font size for a typed mark inside a field box, as a share of the box height
 * (CSS `cqh`), matching how the API stamps it: the classic face at
 * `markSizePt`, a handwriting face scaled by its optical factor but never
 * taller than the API allows
 */
export const markFontSizeCqh = (
  fieldHeightPt: number,
  font: SignatureFont,
): number => {
  const classic = markSizePt(fieldHeightPt);
  const size =
    font === "classic"
      ? classic
      : Math.min(
          classic * opticalScale(font),
          fieldHeightPt * HANDWRITING_MAX_HEIGHT,
        );
  return (size / fieldHeightPt) * 100;
};

/**
 * Font size for a date or text value inside its box, as `cqh`, mirroring the
 * API's `textSize`: close to body copy, at most 14pt
 */
export const textFontSizeCqh = (fieldHeightPt: number): number =>
  (Math.min(fieldHeightPt * 0.78, 14) / fieldHeightPt) * 100;
