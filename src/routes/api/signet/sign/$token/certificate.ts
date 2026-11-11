import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";

/**
 * Proxy the signer's Certificate of Completion download to the Signet API,
 * server-side, so the file is served from the app origin. The sign token is
 * the capability.
 */
export const Route = createFileRoute("/api/signet/sign/$token/certificate")({
  server: {
    handlers: {
      GET: async ({ params }) =>
        fetch(`${signetApiUrl()}/sign/${params.token}/certificate`),
    },
  },
});
