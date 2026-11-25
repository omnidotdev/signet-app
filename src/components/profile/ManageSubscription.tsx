import { SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";

import useHubLoginHint from "@/lib/auth/useHubLoginHint";
import { manageSubscriptionUrl, resolveBaseUrl } from "@/lib/billing/hubLinks";
import { ACCOUNT_URL, BASE_URL } from "@/lib/config/env.config";

interface Props {
  /** Workspace whose subscription to manage */
  workspaceSlug: string;
}

/**
 * Manage a workspace's subscription (change or cancel the plan, payment
 * method, invoices) on the Omni account hub, which opens the billing portal
 * and returns to this workspace's billing page. Hidden when no account hub is
 * configured
 */
const ManageSubscription = ({ workspaceSlug }: Props) => {
  // Resolve the return origin after mount so the server and first client
  // render agree, since production builds with an empty base URL
  const [baseUrl, setBaseUrl] = useState<string>();

  useEffect(() => setBaseUrl(resolveBaseUrl(BASE_URL)), []);

  // The hub opens as the account Signet is signed in as
  const loginHint = useHubLoginHint();

  const href = manageSubscriptionUrl(
    ACCOUNT_URL,
    baseUrl,
    workspaceSlug,
    loginHint,
  );

  if (!href) return null;

  return (
    <a
      href={href}
      className="inline-flex items-center rounded-lg border px-4 py-2 text-sm hover:bg-muted"
    >
      <SettingsIcon className="mr-2 h-4 w-4" />
      Manage subscription
    </a>
  );
};

export default ManageSubscription;
