import { describe, expect, test } from "bun:test";

import { canCorrectSigner } from "./signerCorrection";

describe("canCorrectSigner", () => {
  test("allows correcting a pending signer on a sent document", () => {
    expect(canCorrectSigner("sent", "pending")).toBe(true);
  });

  test("allows correcting a signer who has only viewed the document", () => {
    expect(canCorrectSigner("sent", "viewed")).toBe(true);
  });

  test("refuses a signer who has already signed", () => {
    expect(canCorrectSigner("sent", "signed")).toBe(false);
  });

  test("refuses a signer who has declined", () => {
    expect(canCorrectSigner("sent", "declined")).toBe(false);
  });

  test("refuses on a draft document", () => {
    expect(canCorrectSigner("draft", "pending")).toBe(false);
  });

  test("refuses on a completed document", () => {
    expect(canCorrectSigner("completed", "signed")).toBe(false);
  });
});
