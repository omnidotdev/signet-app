/**
 * Whether the owner can still correct a signer on a document. Corrections (fix a
 * name, reassign an email) are only allowed for a signer who is still pending on
 * a sent document: a signer who has already signed or declined is immutable, so
 * a captured signature can never be invalidated by an edit.
 */
export const canCorrectSigner = (
  documentStatus: string,
  signerStatus: string,
): boolean =>
  documentStatus === "sent" &&
  signerStatus !== "signed" &&
  signerStatus !== "declined";
