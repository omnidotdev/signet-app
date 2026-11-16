import { ensureFreshAccessToken } from "@omnidotdev/providers";
import { decodeJwt } from "jose";

import auth from "@/lib/auth/auth";
import { resolveOrganizationClaims } from "@/server/organizationClaims";

const SERVICE_KEY = process.env.SIGNET_SERVICE_KEY;

/**
 * Build the headers that pass the signed-in sender's identity to the Signet
 * API server-to-server. The app proxies requests with no session cookie, so the
 * API trusts an owner identity only when it arrives with the shared service key
 * (see the API's `.derive`). Returns an empty object when the sender is
 * anonymous or the service key is unset, so quick-sign still works unattributed.
 *
 * The owner id is the Gatekeeper subject (stable across the app's and the API's
 * own OAuth registrations), read from the ID token, so a document owned here is
 * the same owner the API would stamp for a direct sign-in. The organization id
 * is the sender's personal workspace, the default home for their documents.
 */
export const ownerHeaders = async (
  headers: Headers,
): Promise<Record<string, string>> => {
  if (!SERVICE_KEY) return {};

  const session = await auth.api.getSession({ headers });
  if (!session) return {};

  try {
    const tokenResult = await ensureFreshAccessToken({
      getAccessToken: () =>
        auth.api.getAccessToken({ body: { useAccountCookie: true }, headers }),
      refreshToken: () =>
        auth.api.refreshToken({ body: { useAccountCookie: true }, headers }),
    });
    if (!tokenResult?.idToken) return {};

    const payload = decodeJwt(tokenResult.idToken);
    const ownerId = payload.sub;
    if (!ownerId) return {};

    // Hydrated from userinfo when the token carries workspace ids only
    const organizations = await resolveOrganizationClaims(
      payload,
      tokenResult.accessToken,
    );
    const personal = organizations.find((org) => org.type === "personal");

    const out: Record<string, string> = {
      "x-signet-service-key": SERVICE_KEY,
      "x-signet-owner-id": ownerId,
      "x-signet-owner-email": session.user.email ?? "",
    };
    // URL-encoded: a header value cannot carry most non-ASCII names as is
    if (session.user.name)
      out["x-signet-owner-name"] = encodeURIComponent(session.user.name);
    if (personal?.id) out["x-signet-organization-id"] = personal.id;
    return out;
  } catch {
    // An identity we cannot resolve must not block signing; fall through to an
    // unattributed request rather than failing the upload
    return {};
  }
};
