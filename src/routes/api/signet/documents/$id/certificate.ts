import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy the Certificate of Completion for a completed document to the Signet
 * API, forwarding the signed-in owner so only a document they own can be
 * downloaded. Kept on the app origin.
 */
export const Route = createFileRoute("/api/signet/documents/$id/certificate")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        fetch(`${signetApiUrl()}/api/documents/${params.id}/certificate`, {
          headers: await ownerHeaders(request.headers),
        }),
    },
  },
});
