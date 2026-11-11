import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy "save this draft as a reusable template" to the Signet API, forwarding
 * the signed-in owner so only a document they own can be saved.
 */
export const Route = createFileRoute("/api/signet/documents/$id/template")({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        fetch(`${signetApiUrl()}/api/documents/${params.id}/template`, {
          method: "POST",
          headers: await ownerHeaders(request.headers),
        }),
    },
  },
});
