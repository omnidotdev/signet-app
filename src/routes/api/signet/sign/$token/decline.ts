import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";

/**
 * Proxy a signer's decline to the Signet API, server-side. The sign token is
 * the capability; an optional { reason, accessCode } body is forwarded.
 */
export const Route = createFileRoute("/api/signet/sign/$token/decline")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const body = await request.text();
        return fetch(`${signetApiUrl()}/sign/${params.token}/decline`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: body || "{}",
        });
      },
    },
  },
});
