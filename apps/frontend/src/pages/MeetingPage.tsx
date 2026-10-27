import { Link, useParams } from "react-router-dom";
import { type RsvpDTO, type RsvpStatus } from "shared";
import BookCover from "../components/BookCover";
import { RsvpButtons } from "../components/RsvpButtons";
import { useMeeting, useMeetingRsvps } from "../hooks";
import { authClient } from "../lib/auth-client";

// "Thu, Nov 13, 7:00 – 9:00 PM", in the viewer's locale.
const when = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

// Open Library synopses separate paragraphs with blank lines.
const paragraphs = (text: string) =>
  text.split(/\n\s*\n/).filter((p) => p.trim());

const GROUPS: { status: RsvpStatus; heading: string }[] = [
  { status: "YES", heading: "Going" },
  { status: "MAYBE", heading: "Maybe" },
  { status: "NO", heading: "Can't make it" },
];

const fullName = (r: RsvpDTO) => `${r.member.firstName} ${r.member.lastName}`;

// Empty groups are left out.
const WhoIsComing = ({ meetingId }: { meetingId: string }) => {
  const { data } = useMeetingRsvps(meetingId);
  if (!data) {
    return null;
  }
  if (data.rsvps.length === 0) {
    return <p className="muted">No one has answered yet.</p>;
  }
  return (
    <div className="rsvp-groups">
      {GROUPS.map(({ status, heading }) => {
        const members = data.rsvps.filter((r) => r.status === status);
        return (
          members.length > 0 && (
            <div key={status}>
              <h3>
                {heading} <span className="muted">{members.length}</span>
              </h3>
              <ul>
                {members.map((r) => (
                  <li key={r.member.id}>{fullName(r)}</li>
                ))}
              </ul>
            </div>
          )
        );
      })}
    </div>
  );
};

const MeetingPage = () => {
  const { id = "" } = useParams();
  const { data: session } = authClient.useSession();
  const { data: meeting, isPending, error } = useMeeting(id);

  if (isPending) {
    return <p>Loading...</p>;
  }
  if (error) {
    return <p role="alert">{error.message}</p>;
  }

  const { book, venue } = meeting;
  const isOver = meeting.end < new Date();

  return (
    <article className="meeting-page">
      <p>
        <Link to="/events">← All events</Link>
      </p>
      <header className="meeting-header">
        {book && <BookCover book={book} />}
        <div>
          <p className="eyebrow">{meeting.title}</p>
          <h1>{book?.title ?? meeting.title}</h1>
          <p className="byline">{book ? book.author : "Book to be announced"}</p>
          {session?.user.isAdmin && (
            <Link to={`/events/${meeting.id}/edit`}>Edit event</Link>
          )}
        </div>
      </header>

      <dl className="facts facts-large">
        <div>
          <dt>When</dt>
          <dd>
            <time dateTime={meeting.start.toISOString()}>
              {when.formatRange(meeting.start, meeting.end)}
            </time>
          </dd>
        </div>
        <div>
          <dt>Where</dt>
          <dd>
            {venue ? (
              <>
                {venue.name}
                <br />
                {venue.streetAddress}, {venue.city}, {venue.state} {venue.zip}
              </>
            ) : (
              "To be announced"
            )}
          </dd>
        </div>
      </dl>

      {meeting.description && (
        <div className="meeting-description">
          {paragraphs(meeting.description).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}

      <section className="card" aria-labelledby="rsvp-title">
        <h2 id="rsvp-title">{isOver ? "Who came" : "Are you coming?"}</h2>
        {isOver ? (
          <p className="muted">This meeting is over.</p>
        ) : (
          <RsvpButtons meetingId={meeting.id} />
        )}
        <WhoIsComing meetingId={meeting.id} />
      </section>

      {book?.synopsis && (
        <section aria-labelledby="about-title">
          <h2 id="about-title">About the book</h2>
          {paragraphs(book.synopsis).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      )}
    </article>
  );
};

export default MeetingPage;
