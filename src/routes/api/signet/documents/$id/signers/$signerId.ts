import { createFileRoute } from "@tanstack/react-router";

import { signetApiUrl } from "@/lib/signet/config";
import { ownerHeaders } from "@/lib/signet/ownerHeaders";

/**
 * Proxy signer changes to the Signet API, server-side, forwarding the signed-in
 * owner so only a signer on a document they own can be changed.
 *
 * - POST corrects a pending signer on a sent document (rotates and re-sends the
 *   link when the email changes); signed or declined signers cannot be changed.
 * - PATCH edits a signer's name/email on a draft.
 * - DELETE removes a signer from a draft (never the last one).
 */
export const Route = createFileRoute(
  "/api/signet/documents/$id/signers/$signerId",
)({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const body = await request.text();
        return fetch(
          `${signetApiUrl()}/api/documents/${params.id}/signers/${params.signerId}`,
          {
            method: "POST",
            headers: {
              ...(await ownerHeaders(request.headers)),
              "content-type": "application/json",
            },
            body: body || "{}",
          },
        );
      },
      PATCH: async ({ request, params }) => {
        const body = await request.text();
        return fetch(
          `${signetApiUrl()}/api/documents/${params.id}/signers/${params.signerId}`,
          {
            method: "PATCH",
            headers: {
              ...(await ownerHeaders(request.headers)),
              "content-type": "application/json",
            },
            body: body || "{}",
          },
        );
      },
      DELETE: async ({ request, params }) =>
        fetch(
          `${signetApiUrl()}/api/documents/${params.id}/signers/${params.signerId}`,
          {
            method: "DELETE",
            headers: await ownerHeaders(request.headers),
          },
        ),
    },
  },
});
