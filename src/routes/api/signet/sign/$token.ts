import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";

/**
 * Proxy a signer's fill data and signature submission to the Signet API,
 * server-side. The sign token is the capability (the signer is an external
 * party, not a signed-in user), so no owner identity is forwarded.
 */
export const Route = createFileRoute("/api/signet/sign/$token")({
  server: {
    handlers: {
      // the signer's document, fields, and status; forward an access code when
      // the signer has entered one (kept in a header, never the URL)
      GET: async ({ request, params }) => {
        const code = request.headers.get("x-signet-access-code");
        return fetch(`${signetApiUrl()}/api/sign/${params.token}`, {
          headers: code ? { "x-signet-access-code": code } : {},
        });
      },
      // the signer applies their signature
      POST: async ({ request, params }) =>
        fetch(`${signetApiUrl()}/sign/${params.token}`, {
          method: "POST",
          body: request.body,
          headers: {
            "content-type": request.headers.get("content-type") ?? "",
          },
          // @ts-expect-error -- duplex is required to stream a request body
          duplex: "half",
        }),
    },
  },
});
