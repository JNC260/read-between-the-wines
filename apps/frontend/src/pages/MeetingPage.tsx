import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { type RsvpDTO, type RsvpStatus, type VenueDTO } from "shared";
import AddToCalendar from "../components/AddToCalendar";
import Avatar from "../components/Avatar";
import BookCover from "../components/BookCover";
import MeetingAdminActions from "../components/MeetingAdmin";
import { plural, RsvpButtons, RsvpDetails } from "../components/RsvpButtons";
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

const cancelledOn = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

// Open Library synopses separate paragraphs with blank lines.
const paragraphs = (text: string) =>
  text.split(/\n\s*\n/).filter((p) => p.trim());

const GROUPS: { status: RsvpStatus; heading: string }[] = [
  { status: "YES", heading: "Going" },
  { status: "MAYBE", heading: "Maybe" },
  { status: "NO", heading: "Can't make it" },
];

const fullName = (r: RsvpDTO) => `${r.member.firstName} ${r.member.lastName}`;

// The head count includes guests, so whoever's hosting knows how many
// chairs to find. Empty groups are left out.
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
        const people = members.reduce((sum, r) => sum + 1 + r.guestCount, 0);
        return (
          members.length > 0 && (
            <div key={status} className={`rsvp-group rsvp-group-${status.toLowerCase()}`}>
              <h3>
                {heading} <span className="badge">{people}</span>
              </h3>
              <ul>
                {members.map((r) => (
                  <li key={r.member.id}>
                    <Avatar member={r.member} size="small" />
                    <span>
                      {fullName(r)}
                      {r.guestCount > 0 && (
                        <span className="muted"> +{plural(r.guestCount, "guest")}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        );
      })}
    </div>
  );
};

const YOUR_ANSWER: Record<RsvpStatus, string> = {
  YES: "You're going",
  MAYBE: "You might come",
  NO: "You can't make it",
};

// Someone who already answered sees one line instead of the buttons and
// form, with a button to change it. Open from the start for anyone who
// hasn't, and it stays open after their first tap so they can add food and
// guests.
const YourRsvpPanel = ({
  meetingId,
  myStatus,
  mine,
}: {
  meetingId: string;
  myStatus: RsvpStatus | null;
  mine: RsvpDTO | undefined;
}) => {
  const [open, setOpen] = useState(myStatus === null);

  if (!open && myStatus) {
    const details = [
      myStatus !== "NO" && mine?.dish && `bringing ${mine.dish}`,
      myStatus !== "NO" && !!mine?.guestCount && `+${plural(mine.guestCount, "guest")}`,
    ].filter(Boolean);
    return (
      <div className="your-rsvp">
        <p>
          <strong>{YOUR_ANSWER[myStatus]}</strong>
          {details.length > 0 && ` · ${details.join(" · ")}`}
        </p>
        <button type="button" className="button-quiet" onClick={() => setOpen(true)}>
          Change
        </button>
      </div>
    );
  }
  return (
    <>
      <RsvpButtons meetingId={meetingId} />
      <RsvpDetails meetingId={meetingId} />
      {myStatus && (
        <button type="button" onClick={() => setOpen(false)}>
          Done
        </button>
      )}
    </>
  );
};

const YourRsvp = ({ meetingId }: { meetingId: string }) => {
  const { data: session } = authClient.useSession();
  const { data } = useMeetingRsvps(meetingId);
  if (!data) {
    return null;
  }
  return (
    <YourRsvpPanel
      meetingId={meetingId}
      myStatus={data.myStatus}
      mine={data.rsvps.find((r) => r.member.id === session?.user.id)}
    />
  );
};

// So two people don't both bring dessert. Only from people who might come.
const OnTheMenu = ({ meetingId }: { meetingId: string }) => {
  const { data } = useMeetingRsvps(meetingId);
  const dishes = data?.rsvps.filter((r) => r.dish && r.status !== "NO") ?? [];
  if (dishes.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="menu-title">
      <h2 id="menu-title">On the menu</h2>
      <ul className="menu-list">
        {dishes.map((r) => (
          <li key={r.member.id}>
            <span>{r.dish}</span>
            <span className="muted">
              {fullName(r)}
              {r.status === "MAYBE" && " (maybe)"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

const address = (v: VenueDTO) =>
  `${v.streetAddress}, ${v.city}, ${v.state} ${v.zip}`;

// The embed is Google's keyless ?output=embed URL: free and needs no setup,
// but it isn't an official API, so the directions link (Google's documented
// Maps URLs) is there either way.
const Directions = ({ venue }: { venue: VenueDTO }) => {
  const query = encodeURIComponent(`${venue.name}, ${address(venue)}`);
  return (
    <section aria-labelledby="directions-title">
      <h2 id="directions-title">Getting there</h2>
      <iframe
        className="map"
        title={`Map of ${venue.name}`}
        src={`https://maps.google.com/maps?q=${query}&output=embed`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <p>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${query}`}
          target="_blank"
          rel="noreferrer"
        >
          Get directions
        </a>
      </p>
    </section>
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
  const cancelled = meeting.cancelledAt !== null;

  return (
    <article className="meeting-page">
      <p>
        <Link to="/meetings">← All meetings</Link>
      </p>
      <header className="meeting-header">
        {book && <BookCover book={book} />}
        <div>
          <p className="eyebrow">{meeting.title}</p>
          <h1>{book?.title ?? meeting.title}</h1>
          <p className="byline">
            {book ? book.author : cancelled ? "Cancelled" : "Book to be announced"}
          </p>
        </div>
      </header>

      {meeting.cancelledAt && (
        <p className="notice meeting-cancelled" role="status">
          This meeting was cancelled on {cancelledOn.format(meeting.cancelledAt)}.
        </p>
      )}
      {session?.user.isAdmin && <MeetingAdminActions meeting={meeting} />}

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
                {address(venue)}
              </>
            ) : (
              "To be announced"
            )}
          </dd>
        </div>
      </dl>

      {!cancelled && !isOver && <AddToCalendar meeting={meeting} />}

      {meeting.description && (
        <div className="meeting-description">
          {paragraphs(meeting.description).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}

      {/* A cancelled meeting keeps its answers, but nobody can change them. */}
      <section className="card" aria-labelledby="rsvp-title">
        <h2 id="rsvp-title">
          {cancelled ? "Who had answered" : isOver ? "Who came" : "Are you coming?"}
        </h2>
        {cancelled ? null : isOver ? (
          <p className="muted">This meeting is over.</p>
        ) : (
          <YourRsvp meetingId={meeting.id} />
        )}
        <WhoIsComing meetingId={meeting.id} />
      </section>

      {!cancelled && <OnTheMenu meetingId={meeting.id} />}

      {meeting.craft && (
        <section aria-labelledby="craft-title">
          <h2 id="craft-title">Craft</h2>
          {paragraphs(meeting.craft).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      )}

      {book?.synopsis && (
        <section aria-labelledby="about-title">
          <h2 id="about-title">About the book</h2>
          {paragraphs(book.synopsis).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      )}

      {venue && !cancelled && <Directions venue={venue} />}
    </article>
  );
};

export default MeetingPage;
