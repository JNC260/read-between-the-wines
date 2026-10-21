import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { authClient } from "../lib/auth-client";

// Wrap any page that needs a signed-in member:
//   <Route path="/users" element={<RequireAuth><UsersPage /></RequireAuth>} />
// Add `admin` for admin-only pages. The API checks too; this just saves
// members from a form that would only fail.
const RequireAuth = ({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) => {
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
  if (admin && !session.user.isAdmin) {
    return <p>Only admins can see this page.</p>;
  }
  return children;
};

export default RequireAuth;
