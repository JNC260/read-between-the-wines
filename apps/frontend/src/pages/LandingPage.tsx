import { Link, Navigate, useLocation } from "react-router-dom";
import { authClient } from "../lib/auth-client";

const LandingPage = () => {
  const { data: session, isPending } = authClient.useSession();
  const location = useLocation();

  if (isPending) {
    return null;
  }
  if (session?.user.status === "INACTIVE") {
    return <Navigate to="/reactivate" replace />;
  }

  return (
    <div>
      <h1>Read Between the Wines</h1>
      {session ? (
        <p>
          Welcome, {session.user.firstName}! The site is under construction.
          Check back soon.
        </p>
      ) : (
        // Pass along where RequireAuth was sending them, so login can
        // return them there.
        <Link to="/login" state={location.state}>
          Log in
        </Link>
      )}
    </div>
  );
};

export default LandingPage;
