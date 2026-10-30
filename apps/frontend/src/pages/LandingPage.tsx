import { Link, Navigate, useLocation } from "react-router-dom";
import Logo from "../components/Logo";
import MeetingCard from "../components/MeetingCard";
import PollCard from "../components/PollCard";
import ShelfCard from "../components/ShelfCard";
import SuggestionsCard from "../components/SuggestionsCard";
import { useCurrentPoll, useMeetings } from "../hooks";
import { authClient } from "../lib/auth-client";

const today = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

const Squiggle = () => (
  <svg className="squiggle" viewBox="0 0 92 10" aria-hidden="true">
    <path d="M2 6c6-5 10 3 16 0s10-5 16 0 10 3 16 0 10-5 16 0 10 3 16 0" />
  </svg>
);

// The soonest meeting, including one in progress.
const NextMeeting = ({ isAdmin }: { isAdmin: boolean }) => {
  const { data: meetings, error } = useMeetings("upcoming");
  const next = meetings?.[0];
  return (
    <section className="landing-section" aria-label="Next meeting">
      <p className="eyebrow">Next meeting</p>
      {error && <p role="alert">{error.message}</p>}
      {next && <MeetingCard meeting={next} />}
      {meetings?.length === 0 && (
        <div className="card">
          <p>Nothing scheduled yet. Check back soon.</p>
          {isAdmin && <Link to="/meetings/new">Schedule a meeting</Link>}
        </div>
      )}
    </section>
  );
};

// Nothing while loading or when no poll is open. An error just hides the
// card; the poll page itself shows what went wrong.
const OpenPoll = () => {
  const { data: poll } = useCurrentPoll();
  return poll ? <PollCard poll={poll} /> : null;
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

  if (!session) {
    return (
      <div className="welcome">
        <Logo />
        <h1>Read Between the Wines</h1>
        <p className="muted">An invite-only book club. Members, come on in.</p>
        {/* Pass along where RequireAuth was sending them, so login can
            return them there. */}
        <Link to="/login" state={location.state} className="button-link">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="landing">
      <header className="landing-hello">
        <p className="eyebrow">{today.format(new Date())}</p>
        <h1>
          Hi, <mark>{session.user.firstName}</mark>.
        </h1>
        <Squiggle />
      </header>
      <div className="landing-grid">
        <div className="landing-column">
          <NextMeeting isAdmin={!!session.user.isAdmin} />
          <OpenPoll />
        </div>
        <div className="landing-column">
          <SuggestionsCard />
          <ShelfCard />
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
