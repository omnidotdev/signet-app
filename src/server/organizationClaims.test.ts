import { beforeEach, describe, expect, it } from "bun:test";

import { OMNI_CLAIMS_NAMESPACE } from "@omnidotdev/providers";
import { HttpResponse, http } from "msw";

import { AUTH_BASE_URL } from "@/lib/config/env.config";
import { resolveOrganizationClaims } from "@/server/organizationClaims";
import { mswServer } from "@/test/setup/mswServer";

import type { OrganizationClaim } from "@omnidotdev/providers/auth";

const SUB = "user-1";

const rich: OrganizationClaim[] = [
  {
    id: "org-1",
    name: "Personal",
    slug: "me",
    type: "personal",
    roles: ["owner"],
    teams: [],
  },
  {
    id: "org-2",
    name: "Acme",
    slug: "acme",
    type: "team",
    roles: ["member"],
    teams: [{ id: "team-1", name: "Core" }],
  },
];

let userinfoCalls = 0;

beforeEach(() => {
  userinfoCalls = 0;
  mswServer.use(
    http.get(`${AUTH_BASE_URL}/oauth2/userinfo`, ({ request }) => {
      userinfoCalls += 1;
      if (request.headers.get("authorization") !== "Bearer access-token")
        return HttpResponse.json({ error: "invalid_token" }, { status: 401 });
      return HttpResponse.json({ sub: SUB, [OMNI_CLAIMS_NAMESPACE]: rich });
    }),
  );
});

describe("resolveOrganizationClaims", () => {
  it("returns the full claim as-is without calling userinfo", async () => {
    const claims = { sub: SUB, [OMNI_CLAIMS_NAMESPACE]: rich };

    expect(await resolveOrganizationClaims(claims, "access-token")).toEqual(
      rich,
    );
    expect(userinfoCalls).toBe(0);
  });

  it("hydrates a slim claim (ids only) from userinfo into the same shape", async () => {
    const claims = {
      sub: SUB,
      [OMNI_CLAIMS_NAMESPACE]: rich.map(({ id }) => ({ id })),
    };

    expect(
      await resolveOrganizationClaims(claims, "access-token", {
        forceRefresh: true,
      }),
    ).toEqual(rich);
    expect(userinfoCalls).toBe(1);
  });

  it("fails closed when userinfo rejects the token", async () => {
    const claims = { sub: SUB, [OMNI_CLAIMS_NAMESPACE]: [{ id: "org-1" }] };

    expect(
      await resolveOrganizationClaims(claims, "bad-token", {
        forceRefresh: true,
      }),
    ).toEqual([]);
  });

  it("is empty when the token carries no organization claim", async () => {
    expect(
      await resolveOrganizationClaims({ sub: SUB }, "access-token"),
    ).toEqual([]);
  });
});
