import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy the draft editor data (PDF, signers, fields) to the Signet API,
 * forwarding the signed-in owner so only their draft can be loaded.
 */
export const Route = createFileRoute("/api/signet/documents/$id/editor")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        fetch(`${signetApiUrl()}/api/documents/${params.id}/editor`, {
          headers: await ownerHeaders(request.headers),
        }),
    },
  },
});
