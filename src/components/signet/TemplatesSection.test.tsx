import {
  afterAll,
  afterEach,
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
import TemplatesSection from "./TemplatesSection";

const navigate = mock();
const navigateSpy = spyOn(TanStackRouter, "useNavigate").mockReturnValue(
  navigate as unknown as ReturnType<typeof TanStackRouter.useNavigate>,
);

afterEach(cleanup);
// restore so the spy cannot leak into other test files in the same run
afterAll(() => navigateSpy.mockRestore());

const lease = {
  id: "t-lease",
  name: "Lease",
  createdAt: "2026-11-01T00:00:00.000Z",
  fieldCount: 3,
  roles: ["Signer 1", "Signer 2"],
};

const renderSection = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <TemplatesSection />
    </QueryClientProvider>,
  );

describe("TemplatesSection", () => {
  test("starting a multi-signer template asks for a signer per role, in order", async () => {
    let body: { templateId: string; signers: string } | undefined;
    mswServer.use(
      http.get("*/api/signet/templates", () => HttpResponse.json([lease])),
      http.post("*/api/signet/drafts/from-template", async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json({ ok: true, draftId: "d1" });
      }),
    );
    renderSection();
    expect(await screen.findByText("Lease")).toBeTruthy();
    expect(screen.getByText(/2 signers/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Use" }));
    expect(await screen.findByText("Signer 1")).toBeTruthy();
    expect(screen.getByText("Signer 2")).toBeTruthy();

    const create = screen.getByRole("button", {
      name: "Create draft",
    }) as HTMLButtonElement;
    const names = screen.getAllByPlaceholderText("Signer name");
    expect(names).toHaveLength(2);

    // one role filled is not enough
    fireEvent.change(names[0] as HTMLElement, {
      target: { value: "Tenant Ada" },
    });
    expect(create.disabled).toBe(true);
    fireEvent.change(names[1] as HTMLElement, {
      target: { value: "Landlord Grace" },
    });
    expect(create.disabled).toBe(false);

    fireEvent.click(create);
    await new Promise((r) => setTimeout(r, 50));
    expect(body?.templateId).toBe("t-lease");
    expect(JSON.parse(body?.signers ?? "[]")).toEqual([
      { name: "Tenant Ada" },
      { name: "Landlord Grace" },
    ]);
    expect(navigate).toHaveBeenCalledWith({
      to: "/documents/$id/edit",
      params: { id: "d1" },
    });
  });

  test("bulk send opens for the chosen template", async () => {
    mswServer.use(
      http.get("*/api/signet/templates", () => HttpResponse.json([lease])),
    );
    renderSection();
    await screen.findByText("Lease");
    fireEvent.click(screen.getByRole("button", { name: /Bulk send/ }));
    expect(await screen.findByText('Bulk send "Lease"')).toBeTruthy();
  });

  test("a template saved before roles existed still starts with one signer", async () => {
    const { roles: _roles, ...legacy } = lease;
    mswServer.use(
      http.get("*/api/signet/templates", () => HttpResponse.json([legacy])),
    );
    renderSection();
    await screen.findByText("Lease");
    fireEvent.click(screen.getByRole("button", { name: "Use" }));
    expect(await screen.findByText("Signer 1")).toBeTruthy();
    expect(screen.getAllByPlaceholderText("Signer name")).toHaveLength(1);
  });
});
