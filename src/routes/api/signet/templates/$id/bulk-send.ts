import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy a bulk send of one of the owner's templates to the Signet API,
 * forwarding the signed-in owner and the recipient rows.
 */
export const Route = createFileRoute("/api/signet/templates/$id/bulk-send")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const body = await request.text();
        return fetch(
          `${signetApiUrl()}/api/templates/${encodeURIComponent(params.id)}/bulk-send`,
          {
            method: "POST",
            headers: {
              ...(await ownerHeaders(request.headers)),
              "content-type": "application/json",
            },
            body,
          },
        );
      },
    },
  },
});
