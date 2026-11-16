import { describe, expect, mock, test } from "bun:test";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, screen } from "@testing-library/react";

import renderWithRouter from "@/test/renderWithRouter";

// Mock auth client before importing Header
const mockSignIn = mock(() => Promise.resolve());
const mockSignOut = mock(() => Promise.resolve());

mock.module("@/lib/auth/authClient", () => ({
  default: {
    signIn: {
      social: mockSignIn,
    },
    signOut: mockSignOut,
  },
}));

// Mock useTheme
mock.module("@/providers/ThemeProvider", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: mock(() => {}),
  }),
}));

// Import after mocking
const { default: Header } = await import("./Header");

const renderHeader = (
  auth: {
    user: { id: string; email: string; name: string; image: string | null };
  } | null = null,
) => {
  cleanup();

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <Header />
    </QueryClientProvider>,
    { context: { auth } },
  );
};

describe("Header", () => {
  test("renders header element", async () => {
    await renderHeader();

    const header = screen.getByRole("banner");
    expect(header).toBeDefined();
  });

  test("renders pricing link", async () => {
    await renderHeader();

    const pricingLink = screen.getByRole("link", { name: "Pricing" });
    expect(pricingLink).toBeDefined();
  });

  test("shows Sign In button when unauthenticated", async () => {
    await renderHeader(null);

    const signInButton = screen.getByRole("button", { name: "Sign In" });
    expect(signInButton).toBeDefined();
  });

  test("shows user avatar when authenticated", async () => {
    const auth = {
      user: {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        image: null,
      },
    };

    await renderHeader(auth);

    // Should show the first letter of the user's name as fallback
    expect(screen.getByText("T")).toBeDefined();
  });

  test("does not show Sign In button when authenticated", async () => {
    const auth = {
      user: {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        image: null,
      },
    };

    await renderHeader(auth);

    const signInButton = screen.queryByRole("button", { name: "Sign In" });
    expect(signInButton).toBeNull();
  });
});
