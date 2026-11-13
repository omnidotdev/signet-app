import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { forwardedClientHeaders } from "@/lib/signet/forwardedClientHeaders";

/**
 * Proxy a signer's request for a fresh identity-verification code to the Signet
 * API. The sign token is the capability, so no owner identity is forwarded.
 */
export const Route = createFileRoute("/api/signet/sign/$token/otp/request")({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        fetch(`${signetApiUrl()}/api/sign/${params.token}/otp/request`, {
          method: "POST",
          headers: forwardedClientHeaders(request.headers),
        }),
    },
  },
});
