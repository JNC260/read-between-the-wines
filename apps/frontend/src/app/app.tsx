// Uncomment this line to use CSS modules
// import styles from './app.module.css';

import { Route, Routes, Link } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "../api";
import RequireAuth from "../components/RequireAuth";
import SignOutButton from "../components/SignOutButton";
import { authClient } from "../lib/auth-client";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import InvitePage from "../pages/InvitePage";
import LandingPage from "../pages/LandingPage";
import LoginPage from "../pages/LoginPage";
import ReactivatePage from "../pages/ReactivatePage";
import ResetPasswordPage from "../pages/ResetPasswordPage";
import UsersPage from "../pages/UsersPage";

// A 4xx (not found, signed out, forbidden) won't change on a retry, so show
// it right away. Server and network errors still get React Query's default
// three retries.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 3,
    },
  },
});

// Only shown to signed-in members.
const Nav = () => {
  const { data: session } = authClient.useSession();
  if (!session) {
    return null;
  }
  return (
    <nav>
      <ul>
        <li>
          <Link to="/">Home</Link>
        </li>
        <li>
          <Link to="/page-1">Page 1</Link>
        </li>
        <li>
          <Link to="/page-2">Page 2</Link>
        </li>
        <li>
          <Link to="/users">Users</Link>
        </li>
      </ul>
      <SignOutButton />
    </nav>
  );
};

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div>
        <Nav />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route path="/reactivate" element={<ReactivatePage />} />
          <Route
            path="/users"
            element={
              <RequireAuth>
                <UsersPage />
              </RequireAuth>
            }
          />
          {/* Placeholder pages from the Nx template, moved off "/" */}
          <Route
            path="/page-1"
            element={
              <div>
                This is the generated root route.{" "}
                <Link to="/page-2">Click here for page 2.</Link>
              </div>
            }
          />
          <Route
            path="/page-2"
            element={
              <div>
                <Link to="/page-1">Click here to go back to page 1.</Link>
              </div>
            }
          />
        </Routes>
      </div>
    </QueryClientProvider>
  );
}

export default App;
