import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy document endpoints to the Signet API, server-side, forwarding the
 * signed-in sender's identity so uploads are owned (and retrievable) and the
 * list is scoped to them. Returns the JSON the API responds with.
 */
export const Route = createFileRoute("/api/signet/documents")({
  server: {
    handlers: {
      // list the signed-in sender's documents
      GET: async ({ request }) =>
        fetch(`${signetApiUrl()}/api/documents`, {
          headers: await ownerHeaders(request.headers),
        }),
      // create a signing request from an uploaded PDF
      POST: async ({ request }) =>
        fetch(`${signetApiUrl()}/api/documents`, {
          method: "POST",
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
