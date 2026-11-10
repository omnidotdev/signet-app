import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";

/**
 * Proxy the stateless quick-sign to the Signet API, server-side, so the browser
 * never needs cross-origin access. Streams the signed PDF straight back.
 */
export const Route = createFileRoute("/api/signet/sign")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        fetch(`${signetApiUrl()}/api/sign`, {
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
