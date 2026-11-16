/** The longest note a sender can attach to a request (matches the API) */
export const MESSAGE_MAX_LENGTH = 1000;

/** How long a request stays open unless the sender picks otherwise, in days */
export const DEFAULT_EXPIRY_DAYS = "120";

/** The expiry choices offered when sending ("0" never expires) */
export const EXPIRY_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "120", label: "120 days" },
  { value: "365", label: "1 year" },
  { value: "0", label: "Never" },
] as const;

/** A request's expiry as a short date, e.g. "Mar 3, 2027" */
export const formatExpiry = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
