import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as TanStackRouter from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";

import { mswServer } from "@/test/setup/mswServer";
import NewVersionAction from "./NewVersionAction";

const navigate = mock();
const navigateSpy = spyOn(TanStackRouter, "useNavigate").mockReturnValue(
  navigate as unknown as ReturnType<typeof TanStackRouter.useNavigate>,
);

let uploads = 0;
beforeEach(() => {
  uploads = 0;
  navigate.mockClear();
  mswServer.use(
    http.post("*/api/signet/documents/doc-1/revise", async ({ request }) => {
      const form = await request.formData();
      expect(form.get("file")).toBeTruthy();
      uploads += 1;
      return HttpResponse.json(
        { ok: true, draftId: "doc-2", voidedPrevious: false },
        { status: 201 },
      );
    }),
  );
});
afterEach(cleanup);
// restore so the spy cannot leak into other test files in the same run
afterAll(() => navigateSpy.mockRestore());

const renderAction = (status: string, hasNewerVersion = false) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NewVersionAction
        documentId="doc-1"
        documentName="Services agreement"
        status={status}
        hasNewerVersion={hasNewerVersion}
      />
    </QueryClientProvider>,
  );

const pick = (file: File) =>
  fireEvent.change(screen.getByLabelText("New version file"), {
    target: { files: [file] },
  });

const pdf = () =>
  new File(["%PDF-1.7"], "agreement-v2.pdf", { type: "application/pdf" });

const settle = () => new Promise((r) => setTimeout(r, 50));

describe("NewVersionAction", () => {
  test("is not offered on a draft or on a version that already has a newer one", () => {
    renderAction("draft");
    expect(screen.queryByRole("button", { name: /new version/ })).toBeNull();
    cleanup();
    renderAction("completed", true);
    expect(screen.queryByRole("button", { name: /new version/ })).toBeNull();
  });

  test("for a completed document, uploads straight away and opens the new draft", async () => {
    renderAction("completed");
    pick(pdf());
    await settle();
    expect(uploads).toBe(1);
    expect(navigate).toHaveBeenCalledWith({
      to: "/documents/$id/edit",
      params: { id: "doc-2" },
    });
  });

  test("for a document still out for signature, confirms before voiding it", async () => {
    renderAction("sent");
    pick(pdf());
    expect(
      await screen.findByText(
        'Replace "Services agreement" with a new version?',
      ),
    ).toBeTruthy();
    await settle();
    // nothing is voided or uploaded until confirmed
    expect(uploads).toBe(0);

    fireEvent.click(
      screen.getByRole("button", { name: "Void and create new version" }),
    );
    await settle();
    expect(uploads).toBe(1);
    expect(navigate).toHaveBeenCalled();
  });

  test("an unsupported file is never sent", async () => {
    renderAction("completed");
    pick(new File(["x"], "notes.txt", { type: "text/plain" }));
    await settle();
    expect(uploads).toBe(0);
  });
});
