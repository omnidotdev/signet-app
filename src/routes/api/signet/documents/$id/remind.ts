import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy "resend reminder" to the Signet API, server-side, forwarding the
 * signed-in owner so only a document they own can be reminded. An optional
 * { signerId } body targets a single signer instead of every pending one.
 */
export const Route = createFileRoute("/api/signet/documents/$id/remind")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const body = await request.text();
        return fetch(`${signetApiUrl()}/api/documents/${params.id}/remind`, {
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
