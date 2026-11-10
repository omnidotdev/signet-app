import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";

/**
 * Proxy "send for signature" to the Signet API, server-side. Returns the JSON
 * the API responds with (document id and the shareable signing links).
 */
export const Route = createFileRoute("/api/signet/documents")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        fetch(`${signetApiUrl()}/api/documents`, {
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
