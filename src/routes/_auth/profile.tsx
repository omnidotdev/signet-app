import { Link, createFileRoute } from "@tanstack/react-router";

import ApiKeysSection from "@/components/signet/ApiKeysSection";
import { useWorkspace } from "@/lib/context";

/**
 * Profile page. Plans belong to workspaces, not to the user, so this
 * lists the user's workspaces with a way into each one's billing
 */
const ProfilePage = () => {
  const { auth } = Route.useRouteContext();
  const { workspaces } = useWorkspace();

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col text-pretty px-4 py-8 text-center sm:text-start">
      <div className="flex flex-col">
        <h1 className="font-bold text-xl sm:text-3xl">
          Welcome, {auth?.user.name}!
        </h1>
        {auth?.user.email && (
          <p className="text-muted-foreground text-sm sm:text-lg">
            {auth.user.email}
          </p>
        )}
      </div>

      <section className="mt-8 flex flex-col text-start">
        <h2 className="font-bold sm:text-xl">Workspaces</h2>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Plans and billing belong to a workspace.
        </p>

        <ul className="mt-6 flex flex-col gap-3">
          {workspaces.map((workspace) => (
            <li
              key={workspace.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
            >
              <span className="min-w-0 break-words font-medium">
                {workspace.slug}
                {workspace.type === "personal" && (
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
                    Personal
                  </span>
                )}
              </span>
              <Link
                to="/@{$workspaceSlug}/~/billing"
                params={{ workspaceSlug: workspace.slug }}
                className="inline-flex min-h-11 items-center rounded-lg border px-4 font-medium text-sm hover:bg-muted"
              >
                Billing
              </Link>
            </li>
          ))}
        </ul>

        {workspaces.length === 0 && (
          <p className="mt-6 text-muted-foreground">
            No workspaces yet. Create one from your Omni account.
          </p>
        )}
      </section>

      <ApiKeysSection />
    </div>
  );
};

export const Route = createFileRoute("/_auth/profile")({
  component: ProfilePage,
});
