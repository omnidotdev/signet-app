import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy the signed-in owner's reusable templates from the Signet API, on the
 * app origin, forwarding the owner so only their templates are listed.
 */
export const Route = createFileRoute("/api/signet/templates")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        fetch(`${signetApiUrl()}/api/templates`, {
          headers: await ownerHeaders(request.headers),
        }),
    },
  },
});
