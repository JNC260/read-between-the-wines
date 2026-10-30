import { Link, Navigate, useLocation } from "react-router-dom";
import Logo from "../components/Logo";
import MeetingCard from "../components/MeetingCard";
import PollCard, { PollResultsCard } from "../components/PollCard";
import ShelfCard from "../components/ShelfCard";
import SuggestionsCard from "../components/SuggestionsCard";
import { useLatestPoll, useMeetings } from "../hooks";
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

// The soonest meeting, including one in progress, skipping cancelled ones.
const NextMeeting = ({ isAdmin }: { isAdmin: boolean }) => {
  const { data: all, error } = useMeetings("upcoming");
  const meetings = all?.filter((m) => !m.cancelledAt);
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

// How long a closed poll's results stay on the landing page if nobody
// assigns its books to a meeting.
const RESULTS_FOR_MS = 30 * 24 * 60 * 60 * 1000;

// The newest poll: its ballot while it's open, then its results until a
// book from it goes on a meeting. Nothing while loading, and an error just
// hides the card; the poll page itself shows what went wrong.
const LatestPoll = ({ isAdmin }: { isAdmin: boolean }) => {
  const { data: poll } = useLatestPoll();
  if (!poll) {
    return null;
  }
  if (poll.isOpen) {
    return <PollCard poll={poll} />;
  }
  const assigned = poll.books.some((b) => b.meetingId !== null);
  const recent = Date.now() - poll.closesAt.getTime() < RESULTS_FOR_MS;
  return !assigned && recent ? (
    <PollResultsCard poll={poll} isAdmin={isAdmin} />
  ) : null;
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
          <LatestPoll isAdmin={!!session.user.isAdmin} />
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
