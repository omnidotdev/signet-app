import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy the document file (signed if sealed, else the original) to the Signet
 * API, forwarding the signed-in owner, so a sender can open any document from
 * their history at any stage. The query string (e.g. ?disposition=inline, used
 * by the in-app viewer) is forwarded so the API can serve it inline. Kept on
 * the app origin.
 */
export const Route = createFileRoute("/api/signet/documents/$id/file")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const search = new URL(request.url).search;
        return fetch(
          `${signetApiUrl()}/api/documents/${params.id}/file${search}`,
          { headers: await ownerHeaders(request.headers) },
        );
      },
    },
  },
});
