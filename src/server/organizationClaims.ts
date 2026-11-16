import { createOrganizationHydrator } from "@omnidotdev/providers";

import { AUTH_BASE_URL } from "@/lib/config/env.config";

import type { OrganizationClaim } from "@omnidotdev/providers/auth";

/**
 * Hydrates workspace details from Gatekeeper userinfo when the ID token carries
 * workspace ids only (slim claims keep the auth cookie small for users in many
 * workspaces). One per process so its short per-user cache is shared
 */
const organizationHydrator = createOrganizationHydrator({
  userinfoUrl: `${AUTH_BASE_URL}/oauth2/userinfo`,
  logPrefix: "[organizations]",
});

/**
 * The user's workspaces from their ID token claims (read from the app's own
 * trusted auth storage), hydrated from userinfo when the token carries ids
 * only. Server only. Empty when the claim is absent or hydration fails, so
 * callers fail closed
 * @param idTokenClaims - Decoded ID token claims
 * @param accessToken - The session's access token, used for userinfo
 * @param opts - `forceRefresh` skips the short hydration cache
 */
export const resolveOrganizationClaims = (
  idTokenClaims: Record<string, unknown>,
  accessToken: string | undefined,
  opts?: { forceRefresh?: boolean },
): Promise<OrganizationClaim[]> =>
  organizationHydrator.resolve(idTokenClaims, accessToken, opts);
