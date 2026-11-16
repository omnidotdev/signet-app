import { createFileRoute } from "@tanstack/react-router";

import ApiKeysSection from "@/components/signet/ApiKeysSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchSession } from "@/server/functions/auth";
import { getSubscription } from "@/server/functions/subscriptions";

import type { Subscription } from "@omnidotdev/providers";

/**
 * Format Unix timestamp to readable date.
 */
const formatDate = (timestamp: number) =>
  new Date(timestamp * 1000).toLocaleDateString();

/**
 * Subscription card component. Changing, canceling, or renewing the plan
 * happens on the Omni account hub, reached from a workspace's billing page
 */
const SubscriptionCard = ({ subscription }: { subscription: Subscription }) => {
  const isPendingCancellation = subscription.cancelAt !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {subscription.product?.name ?? "Subscription"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Status</dt>
          <dd className="capitalize">
            {isPendingCancellation
              ? `Cancels ${formatDate(subscription.cancelAt!)}`
              : subscription.status}
          </dd>
          <dt className="text-muted-foreground">Current Period Ends</dt>
          <dd>{formatDate(subscription.currentPeriodEnd)}</dd>
          {subscription.product?.description && (
            <>
              <dt className="text-muted-foreground">Description</dt>
              <dd>{subscription.product.description}</dd>
            </>
          )}
        </dl>
      </CardContent>
    </Card>
  );
};

/**
 * Profile page.
 */
const ProfilePage = () => {
  const { auth } = Route.useRouteContext();
  const { subscription } = Route.useLoaderData();

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col text-pretty px-4 py-8 text-center sm:text-start">
      <div className="flex flex-col">
        <h1 className="font-bold text-xl sm:text-3xl">
          Welcome, {auth?.user.name}!
        </h1>
        <h2 className="text-muted-foreground text-sm sm:text-lg">
          Review and manage details about your account below.
        </h2>
      </div>

      <div className="mt-8 flex flex-col text-start">
        <h1 className="font-bold sm:text-xl">Subscription</h1>
        <h2 className="text-muted-foreground text-xs sm:text-sm">
          View details and manage your subscription.
        </h2>

        <div className="mt-6">
          {subscription ? (
            <SubscriptionCard subscription={subscription} />
          ) : (
            <p className="text-muted-foreground">No active subscription.</p>
          )}
        </div>
      </div>

      <ApiKeysSection />
    </div>
  );
};

export const Route = createFileRoute("/_auth/profile")({
  loader: async () => {
    const { session } = await fetchSession();
    if (!session?.user.identityProviderId) {
      return { subscription: null, entityType: "user", entityId: "" };
    }

    const entityType = "user";
    const entityId = session.user.identityProviderId;

    const subscription = await getSubscription({
      data: { entityType, entityId },
    });

    return { subscription, entityType, entityId };
  },
  component: ProfilePage,
});
