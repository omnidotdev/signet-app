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
