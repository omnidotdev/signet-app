import { afterEach, describe, expect, test } from "bun:test";

import { cleanup, render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";

import { mswServer } from "@/test/setup/mswServer";
import SignerFill from "./SignerFill";

const fill = (over: Record<string, unknown>) => ({
  documentName: "Lease",
  signerName: "Grace",
  alreadySigned: false,
  documentCompleted: false,
  waitingFor: null,
  closed: null,
  message: null,
  expiresAt: null,
  pdfBase64: "",
  fields: [],
  ...over,
});

const serve = (body: Record<string, unknown>) =>
  mswServer.use(
    http.get("*/api/signet/sign/tok", () => HttpResponse.json(fill(body))),
  );

afterEach(cleanup);

describe("SignerFill, a link that can no longer be signed", () => {
  test("an expired request says so instead of showing the document", async () => {
    serve({ closed: "expired" });
    render(<SignerFill token="tok" />);
    expect(await screen.findByText("This request has expired")).toBeTruthy();
    expect(screen.queryByText(/review the document and sign/)).toBeNull();
  });

  test("a canceled request says so", async () => {
    serve({ closed: "voided" });
    render(<SignerFill token="tok" />);
    expect(await screen.findByText("This request was canceled")).toBeTruthy();
  });
});

describe("SignerFill, after signing", () => {
  test("waiting on others: no download yet, the final copy comes by email", async () => {
    serve({ alreadySigned: true });
    render(<SignerFill token="tok" />);
    expect(
      await screen.findByText(/emailed the final copy once everyone/),
    ).toBeTruthy();
    expect(screen.queryByText("Download signed PDF")).toBeNull();
  });

  test("once complete: the signed PDF and certificate can be downloaded", async () => {
    serve({ alreadySigned: true, documentCompleted: true });
    render(<SignerFill token="tok" />);
    expect(await screen.findByText("Download signed PDF")).toBeTruthy();
    expect(screen.getByText("Certificate of completion")).toBeTruthy();
  });
});
