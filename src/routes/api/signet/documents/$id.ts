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
      // rename a document the owner owns
      PATCH: async ({ request, params }) =>
        fetch(`${signetApiUrl()}/api/documents/${params.id}`, {
          method: "PATCH",
          body: request.body,
          headers: {
            "content-type": request.headers.get("content-type") ?? "",
            ...(await ownerHeaders(request.headers)),
          },
          // @ts-expect-error -- duplex is required to stream a request body
          duplex: "half",
        }),
      DELETE: async ({ request, params }) =>
        fetch(`${signetApiUrl()}/api/documents/${params.id}`, {
          method: "DELETE",
          headers: await ownerHeaders(request.headers),
        }),
    },
  },
});
