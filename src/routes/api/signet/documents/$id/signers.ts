import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy "add a signer to a draft" to the Signet API, server-side, forwarding
 * the signed-in owner so only a draft they own can gain a signer. Body:
 * { name, email? }.
 */
export const Route = createFileRoute("/api/signet/documents/$id/signers")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const body = await request.text();
        return fetch(`${signetApiUrl()}/api/documents/${params.id}/signers`, {
          method: "POST",
          headers: {
            ...(await ownerHeaders(request.headers)),
            "content-type": "application/json",
          },
          body: body || "{}",
        });
      },
    },
  },
});
