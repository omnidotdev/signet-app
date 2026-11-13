/**
 * The upload formats a sender can turn into a signable PDF: a PDF is used as-is,
 * a PNG or JPEG is placed on a page, and a Word document is converted on the
 * server. The server verifies the file's bytes; these are the browser-side
 * picker filter and pre-check.
 */

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const ACCEPTED_UPLOAD_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  DOCX_MIME,
];
export const ACCEPTED_UPLOAD_EXT = /\.(pdf|png|jpe?g|docx)$/i;
/** For a file input's `accept` attribute */
export const ACCEPTED_UPLOAD_ATTR = `application/pdf,image/png,image/jpeg,${DOCX_MIME},.docx`;
/** Shown when a chosen or uploaded file is not a format we can turn into a PDF */
export const UNSUPPORTED_UPLOAD_MSG =
  "Upload a PDF, image, or Word document (.docx).";

/** Whether a picked or dropped file looks like a supported upload */
export const isAcceptedUpload = (f: { type: string; name: string }): boolean =>
  ACCEPTED_UPLOAD_TYPES.includes(f.type) || ACCEPTED_UPLOAD_EXT.test(f.name);
