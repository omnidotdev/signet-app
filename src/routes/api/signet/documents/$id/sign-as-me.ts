import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy in-app signing to the Signet API, forwarding the signed-in user so the
 * API resolves their signer on this document by email and reuses the token
 * signing flow. The signer's capability token never reaches the browser.
 */
export const Route = createFileRoute("/api/signet/documents/$id/sign-as-me")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        fetch(`${signetApiUrl()}/api/documents/${params.id}/sign-as-me`, {
          headers: await ownerHeaders(request.headers),
        }),
      POST: async ({ request, params }) =>
        fetch(`${signetApiUrl()}/api/documents/${params.id}/sign-as-me`, {
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
