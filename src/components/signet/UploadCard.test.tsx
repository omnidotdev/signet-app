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

import * as TanStackRouter from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";

import { mswServer } from "@/test/setup/mswServer";
import UploadCard from "./UploadCard";

const navigate = mock();
const navigateSpy = spyOn(TanStackRouter, "useNavigate").mockReturnValue(
  navigate as unknown as ReturnType<typeof TanStackRouter.useNavigate>,
);
const contextSpy = spyOn(TanStackRouter, "useRouteContext").mockReturnValue({
  auth: { user: { name: "Brian Cooper", email: "brian@example.com" } },
} as unknown as ReturnType<typeof TanStackRouter.useRouteContext>);

let posted: FormData | null = null;
beforeEach(() => {
  posted = null;
  navigate.mockClear();
  mswServer.use(
    http.post("*/api/signet/documents", async ({ request }) => {
      posted = await request.formData();
      return HttpResponse.json({ id: "doc-9", draft: true }, { status: 201 });
    }),
  );
});
afterEach(cleanup);
// restore so the spies cannot leak into other test files in the same run
afterAll(() => {
  navigateSpy.mockRestore();
  contextSpy.mockRestore();
});

const upload = (container: HTMLElement) => {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("no file input");
  fireEvent.change(input, {
    target: {
      files: [
        new File(["%PDF-1.7"], "agreement.pdf", { type: "application/pdf" }),
      ],
    },
  });
};

const settle = () => new Promise((r) => setTimeout(r, 50));

describe("UploadCard, signed in", () => {
  test("sending opens the document for review instead of emailing anyone", async () => {
    const { container } = render(<UploadCard />);
    upload(container);
    fireEvent.change(screen.getByPlaceholderText("Jordan Rivera"), {
      target: { value: "Mattison Anderson" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Next: review and send" }),
    );
    await settle();

    // saved as a draft: nothing goes out until Send in the editor
    expect(posted?.get("draft")).toBe("true");
    expect(JSON.parse(String(posted?.get("signers")))).toEqual([
      { name: "Mattison Anderson" },
    ]);
    expect(navigate).toHaveBeenCalledWith({
      to: "/documents/$id/edit",
      params: { id: "doc-9" },
    });
  });

  test("signing it yourself opens the document to place your signature", async () => {
    const { container } = render(<UploadCard />);
    upload(container);
    fireEvent.click(screen.getByRole("button", { name: /Sign it myself/ }));
    // consent is given on the signing page, not here
    expect(screen.queryByText(/I agree to sign this document/)).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Next: place your signature" }),
    );
    await settle();

    expect(posted?.get("draft")).toBe("true");
    expect(JSON.parse(String(posted?.get("signers")))).toEqual([
      { name: "Brian Cooper", email: "brian@example.com" },
    ]);
    expect(navigate).toHaveBeenCalledWith({
      to: "/documents/$id/edit",
      params: { id: "doc-9" },
    });
  });
});
