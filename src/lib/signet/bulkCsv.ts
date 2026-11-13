/**
 * Parse a pasted or uploaded CSV of bulk-send recipients. Each line is one
 * document: a name and an email for every signer role, in role order
 * (`name,email` for a one-role template, `name,email,name,email` for two). A
 * first line whose email column is not an email is treated as a header and
 * skipped. Quoted fields (with "" escapes and embedded commas) are supported.
 */

export interface BulkSigner {
  name: string;
  email: string;
}

export interface BulkCsvResult {
  /** valid rows, one per document, each with a signer per role */
  rows: BulkSigner[][];
  /** problems by 1-based line number; any error blocks sending */
  errors: { line: number; message: string }[];
  /** the first line was skipped as a header, so the sender can confirm it was one */
  skippedHeader: string | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Split one CSV line into trimmed cells, honoring double-quoted fields */
export const splitCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell.trim());
  return cells;
};

export const parseBulkCsv = (
  text: string,
  roleCount: number,
): BulkCsvResult => {
  const rows: BulkSigner[][] = [];
  const errors: { line: number; message: string }[] = [];
  const lines = text.split(/\r?\n/);
  const firstLine = lines.findIndex((l) => l.trim());
  let skippedHeader: string | null = null;

  lines.forEach((raw, idx) => {
    const line = idx + 1;
    if (!raw.trim()) return;
    const cells = splitCsvLine(raw);
    // only the first non-blank line can be a header: one whose first email
    // column does not hold an email
    if (idx === firstLine && !EMAIL.test(cells[1] ?? "")) {
      skippedHeader = raw.trim();
      return;
    }

    if (cells.length < roleCount * 2) {
      errors.push({
        line,
        message: `Expected ${roleCount * 2} columns (a name and email per signer), found ${cells.length}.`,
      });
      return;
    }
    const signers: BulkSigner[] = [];
    for (let r = 0; r < roleCount; r++) {
      const name = cells[r * 2] ?? "";
      const email = cells[r * 2 + 1] ?? "";
      if (!name) {
        errors.push({ line, message: `Signer ${r + 1} needs a name.` });
        return;
      }
      if (!EMAIL.test(email)) {
        errors.push({
          line,
          message: `Signer ${r + 1} needs a valid email (got "${email}").`,
        });
        return;
      }
      signers.push({ name, email });
    }
    rows.push(signers);
  });

  return { rows, errors, skippedHeader };
};
