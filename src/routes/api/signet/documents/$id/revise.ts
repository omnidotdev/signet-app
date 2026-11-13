import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy uploading a new version of one of the owner's documents to the Signet
 * API, streaming the multipart upload through with the owner's identity.
 */
export const Route = createFileRoute("/api/signet/documents/$id/revise")({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        fetch(
          `${signetApiUrl()}/api/documents/${encodeURIComponent(params.id)}/revise`,
          {
            method: "POST",
            body: request.body,
            headers: {
              "content-type": request.headers.get("content-type") ?? "",
              ...(await ownerHeaders(request.headers)),
            },
            // @ts-expect-error -- duplex is required to stream a request body
            duplex: "half",
          },
        ),
    },
  },
});
