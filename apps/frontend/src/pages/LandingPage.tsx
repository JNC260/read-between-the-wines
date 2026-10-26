import { Link, Navigate, useLocation } from "react-router-dom";
import { useCurrentPoll } from "../hooks";
import { authClient } from "../lib/auth-client";

const closesOn = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

// Nothing while loading or when no poll is open. An error just hides the
// message; the poll page itself shows what went wrong.
const PollBanner = () => {
  const { data: poll } = useCurrentPoll();
  if (!poll) {
    return null;
  }
  const until = closesOn.format(poll.closesAt);
  return poll.myVotes.length === 0 ? (
    <p role="status">
      There's a new poll available! <Link to={`/polls/${poll.id}`}>Vote now</Link>{" "}
      (closes {until})
    </p>
  ) : (
    <p role="status">
      You've voted in the current poll. You can{" "}
      <Link to={`/polls/${poll.id}`}>change your votes</Link> until {until}.
    </p>
  );
};

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
        <>
          <p>
            Welcome, {session.user.firstName}! The site is under construction.
            Check back soon.
          </p>
          <PollBanner />
        </>
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
