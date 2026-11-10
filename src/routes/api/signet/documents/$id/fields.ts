import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy "replace a draft's fields" to the Signet API, forwarding the signed-in
 * owner so only their draft can be edited.
 */
export const Route = createFileRoute("/api/signet/documents/$id/fields")({
  server: {
    handlers: {
      PUT: async ({ request, params }) =>
        fetch(`${signetApiUrl()}/api/documents/${params.id}/fields`, {
          method: "PUT",
          body: request.body,
          headers: {
            "content-type": request.headers.get("content-type") ?? "",
            ...(await ownerHeaders(request.headers)),
          },
          // @ts-expect-error -- duplex is required to stream a request body
          duplex: "half",
        }),
    },
  },
});
