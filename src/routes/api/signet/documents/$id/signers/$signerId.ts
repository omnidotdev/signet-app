import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy "correct a pending signer" to the Signet API, server-side, forwarding
 * the signed-in owner so only a signer on a document they own can be changed.
 * Body: { name?, email? }. Changing the email rotates the signing link and the
 * API re-sends it; signed or declined signers cannot be changed.
 */
export const Route = createFileRoute(
  "/api/signet/documents/$id/signers/$signerId",
)({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const body = await request.text();
        return fetch(
          `${signetApiUrl()}/api/documents/${params.id}/signers/${params.signerId}`,
          {
            method: "POST",
            headers: {
              ...(await ownerHeaders(request.headers)),
              "content-type": "application/json",
            },
            body: body || "{}",
          },
        );
      },
    },
  },
});
