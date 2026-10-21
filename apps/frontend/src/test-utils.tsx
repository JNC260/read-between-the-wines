import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { authClient } from "./lib/auth-client";

// Specs that use these must mock the auth client first:
//   vi.mock("../lib/auth-client", () => ({ authClient: { useSession: vi.fn() } }));

type TestUser = {
  id: string;
  email: string;
  firstName: string;
  status: "ACTIVE" | "INACTIVE" | "BANNED";
  isAdmin: boolean;
};

export const testUser = (overrides: Partial<TestUser> = {}): TestUser => ({
  id: "00000000-0000-4000-8000-000000000001",
  email: "reader@example.com",
  firstName: "Ada",
  status: "ACTIVE",
  isAdmin: false,
  ...overrides,
});

// Sets what authClient.useSession() returns. Pass null for signed out, or
// "pending" for while the session is still loading.
export const mockSession = (
  user: TestUser | null | "pending",
  refetch = vi.fn(),
) => {
  vi.mocked(authClient.useSession).mockReturnValue({
    data: user && user !== "pending" ? { user, session: {} } : null,
    isPending: user === "pending",
    error: null,
    refetch,
  } as unknown as ReturnType<typeof authClient.useSession>);
  return refetch;
};

// Renders `routes` inside a router starting at `at`, with a fresh React
// Query client. Include stub routes (e.g. <Route path="/" element="landing" />)
// to check where a page redirects.
export const renderRoutes = (
  at: string | { pathname: string; state?: unknown },
  routes: ReactNode,
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>{routes}</Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

export { Route };
