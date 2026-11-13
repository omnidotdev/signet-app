import { afterEach, describe, expect, mock, test } from "bun:test";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";

import { mswServer } from "@/test/setup/mswServer";
import BulkSendDialog from "./BulkSendDialog";

afterEach(cleanup);

const template = {
  id: "t1",
  name: "Offer letter",
  roles: ["Signer 1", "Signer 2"],
};

const renderDialog = (onClose = mock()) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BulkSendDialog template={template} onClose={onClose} />
    </QueryClientProvider>,
  );

const pasteCsv = (csv: string) =>
  fireEvent.change(screen.getByLabelText("Recipients CSV"), {
    target: { value: csv },
  });

describe("BulkSendDialog", () => {
  test("explains the columns for each role", () => {
    renderDialog();
    expect(
      screen.getByText(
        /Signer 1 name, Signer 1 email, Signer 2 name, Signer 2 email/,
      ),
    ).toBeTruthy();
  });

  test("previews a valid CSV and sends exactly its rows", async () => {
    let sent: unknown;
    mswServer.use(
      http.post("*/api/signet/templates/t1/bulk-send", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ ok: true, sent: [{}, {}], failed: [] });
      }),
    );
    const onClose = mock();
    renderDialog(onClose);
    pasteCsv(
      "employee,email,hr,hr email\nAda,ada@example.com,Hannah,hr@example.com\nGrace,grace@example.com,Hannah,hr@example.com",
    );

    expect(screen.getByText("2 documents ready to send.")).toBeTruthy();
    expect(screen.getByText(/Skipped the first line as a header/)).toBeTruthy();
    const send = screen.getByRole("button", { name: "Send 2 documents" });
    fireEvent.click(send);

    await new Promise((r) => setTimeout(r, 50));
    expect(sent).toEqual({
      rows: [
        [
          { name: "Ada", email: "ada@example.com" },
          { name: "Hannah", email: "hr@example.com" },
        ],
        [
          { name: "Grace", email: "grace@example.com" },
          { name: "Hannah", email: "hr@example.com" },
        ],
      ],
    });
    expect(onClose).toHaveBeenCalled();
  });

  test("blocks sending while any line is invalid, naming the line", () => {
    renderDialog();
    pasteCsv(
      "Ada,ada@example.com,Hannah,hr@example.com\nGrace,not-an-email,Hannah,hr@example.com",
    );
    expect(
      screen.getByText(/Line 2: Signer 1 needs a valid email/),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /^Send/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
