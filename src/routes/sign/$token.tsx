import { createFileRoute } from "@tanstack/react-router";

import SignerFill from "@/components/signet/SignerFill";
import createMetaTags from "@/lib/util/createMetaTags";

/**
 * Public signer page. A signer reaches it from the link emailed to them; the
 * sign token in the path is the capability, so no account is required.
 */
export const Route = createFileRoute("/sign/$token")({
  head: () => ({
    meta: createMetaTags({ title: "Sign document" }),
  }),
  component: SignPage,
});

function SignPage() {
  const { token } = Route.useParams();
  return <SignerFill token={token} />;
}
