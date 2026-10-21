import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { authClient } from "../lib/auth-client";

// Wrap any page that needs a signed-in member:
//   <Route path="/users" element={<RequireAuth><UsersPage /></RequireAuth>} />
const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { data: session, isPending } = authClient.useSession();
  const location = useLocation();

  // Render nothing until we know, so signed-out users never see a flash of
  // the page.
  if (isPending) {
    return null;
  }
  if (!session) {
    // Remember where they were going so /login can send them back.
    return <Navigate to="/" replace state={{ from: location }} />;
  }
  if (session.user.status === "INACTIVE") {
    return <Navigate to="/reactivate" replace />;
  }
  // Banned users can't sign in anymore, but could have a session from
  // before the ban.
  if (session.user.status === "BANNED") {
    return <p>This account has been banned.</p>;
  }
  return children;
};

export default RequireAuth;
