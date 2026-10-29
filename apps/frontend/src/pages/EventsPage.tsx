import { Link } from "react-router-dom";
import { type MeetingDTO } from "shared";
import MeetingCard from "../components/MeetingCard";
import { useMeetings } from "../hooks";
import { authClient } from "../lib/auth-client";

// "Oct 14, 2025": past meetings only need the day.
const day = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

// Most recent first. Each opens the meeting page, with who came and what
// was on the menu.
const PastMeetings = ({ meetings }: { meetings: MeetingDTO[] }) => (
  <section className="past-meetings" aria-labelledby="past-title">
    <h2 id="past-title">Past meetings</h2>
    <ul>
      {meetings.map((m) => (
        <li key={m.id}>
          <Link to={`/events/${m.id}`}>{m.book?.title ?? m.title}</Link>
          <time className="muted" dateTime={m.start.toISOString()}>
            {day.format(m.start)}
          </time>
        </li>
      ))}
    </ul>
  </section>
);

const EventsPage = () => {
  const { data: session } = authClient.useSession();
  const upcoming = useMeetings("upcoming");
  const past = useMeetings("past");
  const isAdmin = !!session?.user.isAdmin;

  return (
    <div className="events-page">
      <div className="page-head">
        <h1>Upcoming events</h1>
        {isAdmin && <Link to="/events/new">New event</Link>}
      </div>
      {upcoming.isPending && <p>Loading...</p>}
      {upcoming.error && <p role="alert">{upcoming.error.message}</p>}
      {upcoming.data?.length === 0 && (
        <p>Nothing scheduled yet. Check back soon.</p>
      )}
      {upcoming.data && upcoming.data.length > 0 && (
        <ul className="event-cards">
          {upcoming.data.map((event) => (
            <li key={event.id}>
              <MeetingCard meeting={event} />
              {isAdmin && (
                <Link
                  to={`/events/${event.id}/edit`}
                  aria-label={`Edit ${event.title}`}
                >
                  Edit
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {past.error && <p role="alert">{past.error.message}</p>}
      {past.data && past.data.length > 0 && (
        <PastMeetings meetings={past.data} />
      )}
    </div>
  );
};

export default EventsPage;
