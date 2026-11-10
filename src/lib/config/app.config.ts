/**
 * Application configuration.
 */
const app = {
  name: "Signet",
  // Product symbol, mirrors the omni-api catalog SSOT (`catalog/products.ts`)
  icon: "🖋",
  description:
    "Sign documents with a verifiable signature, a trusted timestamp, and a tamper-evident provenance trail.",
  url: "https://signet.omni.dev",
  docsUrl: "https://docs.omni.dev",
  socials: {
    discord: "https://discord.gg/omnidotdev",
    x: "https://x.com/omnidotdev",
    threads: "https://www.threads.com/@omnidotdev",
  },
  // Legal links mirror the omni-api catalog SSOT
  legal: {
    privacy: "https://omni.dev/legal/privacy",
    terms: "https://omni.dev/legal/terms",
    cookies: "https://omni.dev/legal/cookies",
  },
  organization: {
    name: "Omni",
    url: "https://omni.dev",
    supportEmailAddress: "support@omni.dev",
  },
  /** PWA configuration. Values should match public/manifest.json. */
  pwa: {
    themeColor: "#be6221",
    backgroundColor: "#000000",
  },
};

export default app;
