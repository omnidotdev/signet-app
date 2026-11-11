import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy the signed-in user's saved signature to and from the Signet API,
 * forwarding the signed-in owner so the signature is scoped to their account.
 */
export const Route = createFileRoute("/api/signet/me/signature")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        fetch(`${signetApiUrl()}/api/me/signature`, {
          headers: await ownerHeaders(request.headers),
        }),
      PUT: async ({ request }) =>
        fetch(`${signetApiUrl()}/api/me/signature`, {
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
