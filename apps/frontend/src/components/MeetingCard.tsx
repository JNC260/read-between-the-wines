import { Link } from "react-router-dom";
import { type MeetingDTO } from "shared";
import BookCover from "./BookCover";
import { RsvpButtons, WhoIsGoing } from "./RsvpButtons";

const when = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const stampMonth = new Intl.DateTimeFormat(undefined, { month: "short" });

// Styled like a library due-date stamp: the book is "due back" on the
// meeting day.
const DueStamp = ({ date }: { date: Date }) => (
  <div className="stamp" aria-hidden="true">
    DUE
    <strong>
      {stampMonth.format(date).toUpperCase()} {date.getDate()}
    </strong>
  </div>
);

// The whole card opens the meeting page: the title link stretches over it,
// and the RSVP buttons sit above that link so they still take taps.
const MeetingCard = ({ meeting }: { meeting: MeetingDTO }) => {
  const { book, venue } = meeting;
  return (
    <article className="card meeting-card">
      <DueStamp date={meeting.start} />
      <div className="meeting-card-top">
        {book && <BookCover book={book} />}
        <div className="meeting-card-text">
          <h2>
            <Link to={`/events/${meeting.id}`} className="stretched-link">
              {book?.title ?? meeting.title}
            </Link>
          </h2>
          <p className="byline">
            {book ? book.author : "Book to be announced"}
          </p>
          <dl className="facts">
            <div>
              <dt>When</dt>
              <dd>
                <time dateTime={meeting.start.toISOString()}>
                  {when.format(meeting.start)}
                </time>
              </dd>
            </div>
            <div>
              <dt>Where</dt>
              <dd>
                {venue ? `${venue.name}, ${venue.city}` : "To be announced"}
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="above-link">
        <RsvpButtons meetingId={meeting.id} />
      </div>
      <WhoIsGoing meetingId={meeting.id} />
    </article>
  );
};

export default MeetingCard;
