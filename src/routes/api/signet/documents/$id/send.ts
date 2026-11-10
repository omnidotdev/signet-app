import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy "send this draft" to the Signet API, server-side, forwarding the
 * signed-in owner so the API sends only a draft they own.
 */
export const Route = createFileRoute("/api/signet/documents/$id/send")({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        fetch(`${signetApiUrl()}/api/documents/${params.id}/send`, {
          method: "POST",
          headers: await ownerHeaders(request.headers),
        }),
    },
  },
});
