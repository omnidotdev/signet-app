import { createFileRoute } from "@tanstack/react-router";

import SignerFill from "@/components/signet/SignerFill";
import createMetaTags from "@/lib/util/createMetaTags";

/**
 * In-app signing ceremony for a signed-in user who is also a signer on this
 * document, so a sender can sign their own document without the emailed link.
 * Reuses the signer experience, resolving the capability server-side via the
 * sign-as-me proxy, and loading the user's saved signature.
 */
export const Route = createFileRoute("/_auth/documents/$id/sign")({
  head: () => ({ meta: createMetaTags({ title: "Sign document" }) }),
  component: SignDocumentPage,
});

function SignDocumentPage() {
  const { id } = Route.useParams();
  return (
    <div className="mx-auto w-full max-w-4xl">
      <SignerFill
        basePath={`/api/signet/documents/${id}/sign-as-me`}
        savedSignatureUrl="/api/signet/me/signature"
        backHref={`/documents/${id}`}
      />
    </div>
  );
}
