import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";

import type { ReactNode } from "react";

/**
 * Render UI inside a real in-memory router, with optional router context (e.g.
 * `auth`). Components that use router hooks or links get a real router instead
 * of a mocked router module or spied hooks, which would leak into every test
 * file that runs after them
 */
const renderWithRouter = async (
  ui: ReactNode,
  { context = {}, path = "/" }: { context?: object; path?: string } = {},
) => {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory({ initialEntries: [path] }),
    context,
  });

  // RouterProvider renders nothing until the initial route is loaded
  await router.load();

  return render(<RouterProvider router={router} />);
};

export default renderWithRouter;
