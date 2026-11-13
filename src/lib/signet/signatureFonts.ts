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
    : { fontFamily: FAMILIES[font], fontStyle: "normal", fontWeight: 400 };
