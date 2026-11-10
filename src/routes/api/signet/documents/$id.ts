import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy document deletion to the Signet API, server-side, forwarding the
 * signed-in owner so the API deletes only a document they own.
 */
export const Route = createFileRoute("/api/signet/documents/$id")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) =>
        fetch(`${signetApiUrl()}/api/documents/${params.id}`, {
          method: "DELETE",
          headers: await ownerHeaders(request.headers),
        }),
    },
  },
});
