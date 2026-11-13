import { afterEach, describe, expect, test } from "bun:test";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";

import { mswServer } from "@/test/setup/mswServer";
import ApiKeysSection from "./ApiKeysSection";

const existing = {
  id: "k1",
  name: "Billing server",
  prefix: "sgk_AbCdEfGh",
  createdAt: "2026-11-01T00:00:00.000Z",
  lastUsedAt: null,
};

afterEach(cleanup);

const renderSection = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <ApiKeysSection />
    </QueryClientProvider>,
  );

describe("ApiKeysSection", () => {
  test("lists the owner's keys without any secret", async () => {
    mswServer.use(
      http.get("*/api/signet/keys", () =>
        HttpResponse.json({ keys: [existing] }),
      ),
    );
    renderSection();
    expect(await screen.findByText("Billing server")).toBeTruthy();
    expect(screen.getByText(/never used/)).toBeTruthy();
    expect(screen.getByText(/sgk_AbCdEfGh/)).toBeTruthy();
  });

  test("creating a key shows its secret once, with a warning", async () => {
    let keys = [existing];
    let sentName: string | undefined;
    mswServer.use(
      http.get("*/api/signet/keys", () => HttpResponse.json({ keys })),
      http.post("*/api/signet/keys", async ({ request }) => {
        sentName = ((await request.json()) as { name: string }).name;
        const created = {
          id: "k2",
          name: sentName,
          prefix: "sgk_NewKey12",
          createdAt: "2026-11-13T00:00:00.000Z",
          lastUsedAt: null,
        };
        keys = [created, existing];
        return HttpResponse.json(
          {
            ok: true,
            key: { ...created, secret: "sgk_NewKey12-the-full-secret" },
          },
          { status: 201 },
        );
      }),
    );
    renderSection();
    await screen.findByText("Billing server");

    fireEvent.change(screen.getByLabelText("Key name"), {
      target: { value: "  CI pipeline  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create key" }));

    expect(
      await screen.findByText("sgk_NewKey12-the-full-secret"),
    ).toBeTruthy();
    expect(screen.getByText(/won't be able to see it again/)).toBeTruthy();
    expect(sentName).toBe("CI pipeline");
    // the list refreshes to include the new key (by name, never the secret)
    expect(await screen.findByText("CI pipeline")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /hide the key/ }));
    expect(screen.queryByText("sgk_NewKey12-the-full-secret")).toBeNull();
  });

  test("revoking asks for confirmation naming the key, then revokes it", async () => {
    // widened so the assertions after the handler runs are not narrowed to null
    let revoked = null as string | null;
    mswServer.use(
      http.get("*/api/signet/keys", () =>
        HttpResponse.json({ keys: revoked ? [] : [existing] }),
      ),
      http.delete("*/api/signet/keys/:id", ({ params }) => {
        revoked = params.id as string;
        return HttpResponse.json({ ok: true });
      }),
    );
    renderSection();
    await screen.findByText("Billing server");

    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    expect(
      await screen.findByText('Revoke API key "Billing server"?'),
    ).toBeTruthy();
    // nothing is revoked until the destructive action is confirmed
    expect(revoked).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Revoke key" }));
    expect(await screen.findByText("No API keys yet.")).toBeTruthy();
    expect(revoked).toBe("k1");
  });
});
