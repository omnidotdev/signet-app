export interface FillableField {
  id: string;
  type: string;
  required?: boolean;
  options?: string[] | null;
}

/**
 * Whether a field still needs the signer's input, given the current values. A
 * signature/initials field is satisfied once the signer has adopted a
 * signature; text/dropdown/radio need a non-empty value; a checkbox needs to be
 * ticked; a date fills itself.
 */
export const isFieldIncomplete = (
  field: Pick<FillableField, "type">,
  ctx: { textValue: string; hasSignature: boolean },
): boolean => {
  switch (field.type) {
    case "signature":
    case "initials":
      return !ctx.hasSignature;
    case "text":
    case "dropdown":
    case "radio":
      return !ctx.textValue.trim();
    case "checkbox":
      return ctx.textValue !== "true";
    default:
      return false;
  }
};

/**
 * Whether a field is part of the required-field tour: it is required (defaults
 * to true) and not a date (which fills itself).
 */
export const isTourField = (field: FillableField): boolean =>
  field.required !== false && field.type !== "date";

/** Whether a field is where the signer actually signs */
export const isSignatureField = (field: Pick<FillableField, "type">): boolean =>
  field.type === "signature" || field.type === "initials";

/**
 * Where the floating signing guide should point. It leads to the next field
 * still needing input; once nothing is outstanding it leads to the signature so
 * the signer can scroll back to review it before submitting. A signature is
 * pre-filled from the signer's name, so without this fallback the guide would
 * vanish on the first paint and never prompt the signer to scroll down to where
 * they sign. The target is persistent (not retired once seen): the caller shows
 * or hides the guide by whether this target is on screen, so scrolling away from
 * the signature brings the guide back. Returns null when there is nothing to
 * point at.
 */
export const guideTargetField = <T extends FillableField>(
  tourFields: T[],
  isIncomplete: (field: T) => boolean,
): T | null => {
  const next = tourFields.find(isIncomplete);
  if (next) return next;
  return tourFields.find(isSignatureField) ?? null;
};

/**
 * Whether the floating guide should show, and which way it points, given where
 * the target field sits in the viewport. The guide is a "scroll to" prompt, so
 * it hides while the target is in view (the field itself is the cue then) and
 * comes back, pointing up or down, once the signer scrolls it away. `top`
 * excludes the sticky header and toolbar, `bottom` the guide's own strip, so a
 * field hidden behind either still counts as off screen.
 */
export const guidePlacement = (
  rect: { top: number; bottom: number },
  viewport: { top: number; bottom: number },
): { show: boolean; dir: "up" | "down" } => {
  const inView = rect.top >= viewport.top && rect.bottom <= viewport.bottom;
  return { show: !inView, dir: rect.bottom <= viewport.top ? "up" : "down" };
};
