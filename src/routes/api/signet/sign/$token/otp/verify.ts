import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { forwardedClientHeaders } from "@/lib/signet/forwardedClientHeaders";

/**
 * Proxy a signer's one-time-code submission to the Signet API. The sign token
 * is the capability, so no owner identity is forwarded.
 */
export const Route = createFileRoute("/api/signet/sign/$token/otp/verify")({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        fetch(`${signetApiUrl()}/api/sign/${params.token}/otp/verify`, {
          method: "POST",
          body: request.body,
          headers: {
            "content-type": request.headers.get("content-type") ?? "",
            ...forwardedClientHeaders(request.headers),
          },
          // @ts-expect-error -- duplex is required to stream a request body
          duplex: "half",
        }),
    },
  },
});
