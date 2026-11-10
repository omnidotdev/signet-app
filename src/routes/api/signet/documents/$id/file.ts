import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy the document file (signed if sealed, else the original) to the Signet
 * API, forwarding the signed-in owner, so a sender can open any document from
 * their history at any stage. Kept on the app origin.
 */
export const Route = createFileRoute("/api/signet/documents/$id/file")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        fetch(`${signetApiUrl()}/api/documents/${params.id}/file`, {
          headers: await ownerHeaders(request.headers),
        }),
    },
  },
});
