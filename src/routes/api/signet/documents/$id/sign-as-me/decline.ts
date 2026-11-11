import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy an in-app decline to the Signet API, forwarding the signed-in user so
 * the API resolves their signer on this document and voids it on their behalf.
 */
export const Route = createFileRoute(
  "/api/signet/documents/$id/sign-as-me/decline",
)({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        fetch(
          `${signetApiUrl()}/api/documents/${params.id}/sign-as-me/decline`,
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
