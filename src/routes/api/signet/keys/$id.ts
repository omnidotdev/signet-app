import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/** Proxy revoking one of the signed-in owner's managed API keys */
export const Route = createFileRoute("/api/signet/keys/$id")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) =>
        fetch(`${signetApiUrl()}/api/keys/${encodeURIComponent(params.id)}`, {
          method: "DELETE",
          headers: await ownerHeaders(request.headers),
        }),
    },
  },
});
