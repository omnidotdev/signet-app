/**
 * Render the ISO date (yyyy-mm-dd) a date field carries into the display string
 * the sender configured. This mirrors the server's formatting so the signer sees
 * the same date in the fill page that lands in the signed PDF. A value that is
 * not a plain ISO date is returned unchanged and an unknown format falls back to
 * ISO.
 */

export const DATE_FORMATS = ["iso", "us", "eu", "long"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

/** Labelled options for the sender's date-format picker, with a live example */
export const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: "iso", label: "2026-01-31 (ISO)" },
  { value: "us", label: "01/31/2026 (US)" },
  { value: "eu", label: "31/01/2026 (EU)" },
  { value: "long", label: "January 31, 2026 (long)" },
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const formatDate = (value: string, format?: string | null): string => {
  const match = ISO_DATE.exec(value);
  if (!match) return value;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return value;
  const mm = m as string;
  const dd = d as string;
  switch (format) {
    case "us":
      return `${mm}/${dd}/${year}`;
    case "eu":
      return `${dd}/${mm}/${year}`;
    case "long":
      return `${MONTHS[month - 1]} ${day}, ${year}`;
    default:
      return value;
  }
};
