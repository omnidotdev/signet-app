import { Link, createFileRoute } from "@tanstack/react-router";

import { ManageSubscription } from "@/components/profile";
import { useWorkspace } from "@/lib/context";
import { getOrganizationBySlug } from "@/server/functions/organizations";
import { getSubscription } from "@/server/functions/subscriptions";

export const Route = createFileRoute("/_auth/@{$workspaceSlug}/~/billing")({
  loader: async ({ params }) => {
    const organization = await getOrganizationBySlug({
      data: { slug: params.workspaceSlug },
    }).catch(() => null);

    if (!organization?.id) return { subscription: null };

    // The live subscription decides whether there is a plan to manage
    const subscription = await getSubscription({
      data: { organizationId: organization.id },
    }).catch(() => null);

    return { subscription };
  },
  component: WorkspaceBillingPage,
});

/**
 * Workspace billing page. Buying, changing, and canceling the plan happen on
 * the Omni account hub, which returns here
 */
function WorkspaceBillingPage() {
  const { workspaceSlug } = Route.useParams();
  const { workspaces } = useWorkspace();
  const { subscription } = Route.useLoaderData();

  const org = workspaces.find((o) => o.slug === workspaceSlug);

  if (!org) return null;

  return (
    <div className="container mx-auto py-8">
      <h1 className="mb-6 font-bold text-2xl">Billing</h1>

      <div className="space-y-6">
        {/* Current Plan */}
        <section className="rounded-lg border p-6">
          <h2 className="mb-4 font-semibold text-lg">Current Plan</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-2xl">Free</p>
              <p className="text-muted-foreground text-sm">
                Basic features for personal use
              </p>
            </div>
            {subscription ? (
              <ManageSubscription workspaceSlug={org.slug} />
            ) : (
              <Link
                to="/pricing"
                className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
              >
                Upgrade Plan
              </Link>
            )}
          </div>
        </section>

        {/* Usage Placeholder */}
        <section className="rounded-lg border p-6">
          <h2 className="mb-4 font-semibold text-lg">Usage</h2>
          <p className="text-muted-foreground text-sm">
            Usage metrics will appear here once entitlements are configured via
            Aether.
          </p>
        </section>

        {/* Integration Note */}
        <section className="rounded-lg border border-dashed p-6">
          <h2 className="mb-2 font-semibold text-lg">Integration Guide</h2>
          <p className="text-muted-foreground text-sm">
            This page is a placeholder for workspace billing. To enable full
            billing functionality:
          </p>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-muted-foreground text-sm">
            <li>Configure Aether for entitlement management</li>
            <li>
              Set up plans, which are bought and managed on the Omni account hub
            </li>
          </ol>
        </section>
      </div>
    </div>
  );
}
