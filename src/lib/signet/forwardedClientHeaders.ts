/**
 * Forward the signer's network identity (origin IP and browser user-agent) to
 * the Signet API so it can record them in the tamper-evident audit trail. The
 * app is a reverse proxy, so without this the API would only ever see the app
 * server's address.
 *
 * The real client address arrives on the inbound request as `x-forwarded-for`
 * (set by the edge proxy; leftmost hop is the client) or `x-real-ip`; pass
 * whichever is present straight through, along with the user-agent. Returns
 * only the headers that exist, so nothing is fabricated.
 */
export const forwardedClientHeaders = (
  headers: Headers,
): Record<string, string> => {
  const out: Record<string, string> = {};
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) out["x-forwarded-for"] = forwardedFor;
  const realIp = headers.get("x-real-ip");
  if (realIp) out["x-real-ip"] = realIp;
  const userAgent = headers.get("user-agent");
  if (userAgent) out["user-agent"] = userAgent;
  return out;
};
