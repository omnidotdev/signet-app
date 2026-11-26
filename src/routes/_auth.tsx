import { useIdentitySync } from "@omnidotdev/providers/react";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { followSignOut, followSwitch } from "@/lib/auth/followIdentity";
import { WorkspaceProvider } from "@/lib/context";
import { EventsProvider } from "@/providers/EventsProvider";
import { getUserOrganizations } from "@/server/functions/auth";

// Noop provider for client-side (main @omnidotdev/providers entry requires Node.js)
const eventsProvider = {
  async emit() {
    return {
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
  },
};

export const Route = createFileRoute("/_auth")({
  beforeLoad: async ({ context: { auth } }) => {
    if (!auth) throw redirect({ to: "/" });

    // Workspaces come from the IDP token claims; every signed-in page
    // (workspace pages, billing, profile) reads them through the provider
    const organizations = await getUserOrganizations().catch(() => []);

    return { organizations };
  },
  component: AuthLayout,
});

/**
 * Auth layout.
 */
function AuthLayout() {
  const { auth, authBaseUrl, organizations } = Route.useRouteContext();

  // Stay signed in as the same account as Omni: follow a switch or sign-out
  // made in another app
  useIdentitySync({
    authBaseUrl,
    subject: auth?.user?.identityProviderId,
    onSignedOut: followSignOut,
    onSwitched: followSwitch,
  });

  return (
    <WorkspaceProvider workspaces={organizations}>
      <EventsProvider provider={eventsProvider}>
        <Outlet />
      </EventsProvider>
    </WorkspaceProvider>
  );
}
