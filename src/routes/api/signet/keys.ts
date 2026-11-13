import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy the signed-in owner's managed API keys to the Signet API: list them, or
 * issue a new one (whose secret the API returns exactly once).
 */
export const Route = createFileRoute("/api/signet/keys")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        fetch(`${signetApiUrl()}/api/keys`, {
          headers: await ownerHeaders(request.headers),
        }),
      POST: async ({ request }) =>
        fetch(`${signetApiUrl()}/api/keys`, {
          method: "POST",
          headers: {
            ...(await ownerHeaders(request.headers)),
            "content-type": "application/json",
          },
          body: await request.text(),
        }),
    },
  },
});
