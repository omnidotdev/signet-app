import { describe, expect, test } from "bun:test";

import { parseBulkCsv, splitCsvLine } from "./bulkCsv";

describe("splitCsvLine", () => {
  test("splits on commas and trims cells", () => {
    expect(splitCsvLine(" Ada , ada@example.com ")).toEqual([
      "Ada",
      "ada@example.com",
    ]);
  });

  test("keeps commas and escaped quotes inside a quoted field", () => {
    expect(splitCsvLine('"Lovelace, Ada","say ""hi""",x')).toEqual([
      "Lovelace, Ada",
      'say "hi"',
      "x",
    ]);
  });
});

describe("parseBulkCsv", () => {
  test("one row per line for a single-role template", () => {
    const { rows, errors } = parseBulkCsv(
      "Ada,ada@example.com\nGrace,grace@example.com\n",
      1,
    );
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      [{ name: "Ada", email: "ada@example.com" }],
      [{ name: "Grace", email: "grace@example.com" }],
    ]);
  });

  test("a name and email per role, in role order", () => {
    const { rows } = parseBulkCsv(
      "Ada,ada@example.com,Hannah,hr@example.com",
      2,
    );
    expect(rows).toEqual([
      [
        { name: "Ada", email: "ada@example.com" },
        { name: "Hannah", email: "hr@example.com" },
      ],
    ]);
  });

  test("skips a header line and blank lines", () => {
    const { rows, errors } = parseBulkCsv(
      "name,email\n\nAda,ada@example.com\n   \n",
      1,
    );
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
  });

  test("says when it skipped a header, so a mistyped first row is not lost silently", () => {
    expect(
      parseBulkCsv("name,email\nAda,ada@example.com", 1).skippedHeader,
    ).toBe("name,email");
    expect(parseBulkCsv("Ada,ada@example.com", 1).skippedHeader).toBeNull();
  });

  test("reports bad lines by line number and keeps the good ones", () => {
    const { rows, errors } = parseBulkCsv(
      "Ada,ada@example.com\nGrace,not-an-email\n,nobody@example.com\nOnly",
      1,
    );
    expect(rows).toHaveLength(1);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4]);
  });

  test("a later non-email line is an error, not a second header", () => {
    const { errors } = parseBulkCsv("Ada,ada@example.com\nname,email", 1);
    expect(errors.map((e) => e.line)).toEqual([2]);
  });
});
