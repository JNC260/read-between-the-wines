import { Navigate, useNavigate } from "react-router-dom";
import SignOutButton from "../components/SignOutButton";
import { useReactivateAccount } from "../hooks";
import { authClient } from "../lib/auth-client";

// Where inactive members land. Anyone made inactive (by themselves or an
// admin) can come back.
const ReactivatePage = () => {
  const { data: session, isPending, refetch } = authClient.useSession();
  const navigate = useNavigate();
  const reactivate = useReactivateAccount();

  if (isPending) {
    return null;
  }
  if (!session || session.user.status !== "INACTIVE") {
    return <Navigate to="/" replace />;
  }

  const handleReactivate = () => {
    reactivate.mutate(undefined, {
      // Refresh the session so its status reads ACTIVE before leaving,
      // otherwise the landing page would send them straight back here.
      onSuccess: async () => {
        await refetch();
        navigate("/", { replace: true });
      },
    });
  };

  return (
    <div>
      <h1>Welcome back, {session.user.firstName}!</h1>
      <p>Your account is inactive. Reactivate it to rejoin the club.</p>
      {reactivate.error && <p role="alert">{reactivate.error.message}</p>}
      <button
        type="button"
        disabled={reactivate.isPending}
        onClick={handleReactivate}
      >
        {reactivate.isPending ? "Reactivating..." : "Reactivate my account"}
      </button>
      <SignOutButton />
    </div>
  );
};

export default ReactivatePage;
