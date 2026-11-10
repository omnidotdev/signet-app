/** Base URL of the Signet signing API (server-side only). */
export const signetApiUrl = (): string =>
  process.env.SIGNET_API_URL ?? "https://signet.omni.dev";
