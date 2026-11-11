import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy "start a draft from a template" to the Signet API, forwarding the
 * signed-in owner and the chosen template id plus signers.
 */
export const Route = createFileRoute("/api/signet/drafts/from-template")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        return fetch(`${signetApiUrl()}/api/drafts/from-template`, {
          method: "POST",
          headers: {
            ...(await ownerHeaders(request.headers)),
            "content-type": "application/json",
          },
          body,
        });
      },
    },
  },
});
