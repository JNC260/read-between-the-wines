import { Link } from "react-router-dom";
import { type MeetingDTO } from "shared";
import BookCover from "../components/BookCover";
import MeetingCard from "../components/MeetingCard";
import { useMeetings } from "../hooks";
import { authClient } from "../lib/auth-client";

const today = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const month = new Intl.DateTimeFormat(undefined, { month: "short" });

// Newest first, in one group per year: [[2026, [...]], [2025, [...]]].
// Past meetings arrive newest first, so each group stays in that order.
const byYear = (meetings: MeetingDTO[]) => {
  const years = new Map<number, MeetingDTO[]>();
  for (const m of meetings) {
    const year = m.start.getFullYear();
    years.set(year, [...(years.get(year) ?? []), m]);
  }
  return [...years];
};

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

// A calendar-page date beside the rail: "OCT" over "20".
const DateStamp = ({ date }: { date: Date }) => (
  <time className="date-stamp" dateTime={date.toISOString()}>
    <span>{month.format(date)}</span>
    <b>{date.getDate()}</b>
  </time>
);

// One past meeting: its date, the book's cover, title and author, and where
// it was. The title link stretches over the whole row.
const PastMeeting = ({ meeting }: { meeting: MeetingDTO }) => {
  const { book, venue } = meeting;
  return (
    <li className="timeline-entry">
      <DateStamp date={meeting.start} />
      {book && (
        <div className="timeline-cover">
          <BookCover book={book} />
        </div>
      )}
      <div className="timeline-text">
        <h4>
          <Link to={`/meetings/${meeting.id}`} className="stretched-link">
            {book?.title ?? meeting.title}
          </Link>
        </h4>
        {book && <p className="byline">{book.author}</p>}
        {venue && <p className="muted">{venue.name}</p>}
      </div>
    </li>
  );
};

// Every meeting on one timeline, newest at the top: what's coming up, a
// "today" marker, then everything we've met for, year by year.
const MeetingsPage = () => {
  const { data: session } = authClient.useSession();
  const upcoming = useMeetings("upcoming");
  const past = useMeetings("past");
  const isAdmin = !!session?.user.isAdmin;

  return (
    <div className="meetings-page">
      <div className="page-head">
        <div>
          <h1>Meetings</h1>
          {past.data && past.data.length > 0 && (
            <p className="muted">
              {plural(past.data.length, "meeting")} since{" "}
              {past.data[past.data.length - 1].start.getFullYear()}
            </p>
          )}
        </div>
        {isAdmin && (
          <Link to="/meetings/new" className="button-link button-quiet">
            New meeting
          </Link>
        )}
      </div>

      <div className="timeline">
        <section className="timeline-upcoming" aria-labelledby="upcoming-title">
          <h2 id="upcoming-title" className="timeline-label">
            Coming up
          </h2>
          {upcoming.isPending && <p>Loading...</p>}
          {upcoming.error && <p role="alert">{upcoming.error.message}</p>}
          {upcoming.data?.length === 0 && (
            <p className="muted">Nothing scheduled yet. Check back soon.</p>
          )}
          {upcoming.data && upcoming.data.length > 0 && (
            <ol className="timeline-cards">
              {upcoming.data.map((meeting) => (
                <li key={meeting.id}>
                  <MeetingCard meeting={meeting} />
                  {isAdmin && (
                    <Link
                      to={`/meetings/${meeting.id}/edit`}
                      aria-label={`Edit ${meeting.title}`}
                      className="timeline-edit"
                    >
                      Edit
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <p className="timeline-today">
          Today <span>{today.format(new Date())}</span>
        </p>

        {past.error && <p role="alert">{past.error.message}</p>}
        {past.data && past.data.length > 0 && (
          <section aria-labelledby="past-title">
            <h2 id="past-title" className="visually-hidden">
              Past meetings
            </h2>
            {byYear(past.data).map(([year, meetings]) => (
              <section
                key={year}
                className="timeline-year"
                aria-labelledby={`year-${year}`}
              >
                <h3 id={`year-${year}`} className="timeline-label">
                  {year} <span>{plural(meetings.length, "meeting")}</span>
                </h3>
                <ol>
                  {meetings.map((m) => (
                    <PastMeeting key={m.id} meeting={m} />
                  ))}
                </ol>
              </section>
            ))}
          </section>
        )}
      </div>
    </div>
  );
};

export default MeetingsPage;
