import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy an owner-scoped signed-PDF download, server-side, forwarding the
 * signed-in sender's identity so the API returns the file only to someone who
 * owns the document or shares its workspace. Keeps downloads on the app origin
 * rather than the signing API host.
 */
export const Route = createFileRoute("/api/signet/documents/$id/signed")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        fetch(`${signetApiUrl()}/dashboard/d/${params.id}/signed`, {
          headers: await ownerHeaders(request.headers),
          redirect: "manual",
        }),
    },
  },
});
