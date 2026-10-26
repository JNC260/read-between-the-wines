import { Link } from "react-router-dom";
import { type MeetingDTO } from "shared";
import { useMeetings } from "../hooks";
import { authClient } from "../lib/auth-client";

// In the viewer's locale. formatRange shows the date once for same-day
// events: "Wed, Nov 4, 7:00 – 9:00 PM".
const when = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const EventItem = ({
  event,
  canEdit,
}: {
  event: MeetingDTO;
  canEdit: boolean;
}) => (
  <li>
    <h2>{event.title}</h2>
    {canEdit && (
      <Link
        to={`/events/${event.id}/edit`}
        aria-label={`Edit ${event.title}`}
      >
        Edit
      </Link>
    )}
    <p>
      <time dateTime={event.start.toISOString()}>
        {when.formatRange(event.start, event.end)}
      </time>
    </p>
    {event.book && (
      <p>
        Reading <strong>{event.book.title}</strong> by {event.book.author}
      </p>
    )}
    {event.venue ? (
      <p>
        {event.venue.name}, {event.venue.streetAddress}, {event.venue.city}
      </p>
    ) : (
      <p>Location to be announced</p>
    )}
    {event.description && <p>{event.description}</p>}
  </li>
);

const EventsPage = () => {
  const { data: session } = authClient.useSession();
  const { data: events, isPending, error } = useMeetings("upcoming");

  return (
    <div>
      <h1>Upcoming events</h1>
      {session?.user.isAdmin && <Link to="/events/new">New event</Link>}
      {isPending && <p>Loading...</p>}
      {error && <p role="alert">{error.message}</p>}
      {events?.length === 0 && <p>Nothing scheduled yet. Check back soon.</p>}
      {events && events.length > 0 && (
        <ul>
          {events.map((event) => (
            <EventItem
              key={event.id}
              event={event}
              canEdit={!!session?.user.isAdmin}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

export default EventsPage;
