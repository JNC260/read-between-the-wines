import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { type MeetingDTO, type PollDTO } from "shared";
import { useClosePoll, useUpdateMeeting } from "../hooks";

const meetingDay = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const meetingLabel = (m: MeetingDTO) => `${meetingDay.format(m.start)} · ${m.title}`;

// The admin's tools at the top of a poll: edit or close it while it's open,
// reopen it once it's closed. Closing asks once first, right here, since
// members can't vote after.
export const PollAdminActions = ({ poll }: { poll: PollDTO }) => {
  const close = useClosePoll();
  const [confirming, setConfirming] = useState(false);

  if (!poll.isOpen) {
    return (
      <div className="poll-admin">
        <Link to={`/polls/${poll.id}/edit`} className="button-link button-quiet">
          Reopen voting
        </Link>
      </div>
    );
  }

  return (
    <div className="poll-admin">
      {confirming ? (
        <div className="card poll-admin-confirm" role="group" aria-label="Close voting">
          <p>
            Close voting now? Members won't be able to vote or change their votes,
            and everyone will see the results.
          </p>
          {close.error && <p role="alert">{close.error.message}</p>}
          <div className="poll-admin-buttons">
            <button
              type="button"
              className="button-primary"
              disabled={close.isPending}
              onClick={() => close.mutate(poll.id)}
            >
              {close.isPending ? "Closing..." : "Close voting"}
            </button>
            <button type="button" className="button-quiet" onClick={() => setConfirming(false)}>
              Keep it open
            </button>
          </div>
        </div>
      ) : (
        <>
          <Link to={`/polls/${poll.id}/edit`} className="button-link button-quiet">
            Edit poll
          </Link>
          <button type="button" className="button-quiet" onClick={() => setConfirming(true)}>
            Close voting now
          </button>
        </>
      )}
    </div>
  );
};

// Under a closed poll's result: which meeting the book is on, or for admins,
// a choice of the upcoming meetings that still need a book.
export const AssignBook = ({
  pollId,
  bookId,
  bookTitle,
  meetingId,
  upcoming,
  isAdmin,
}: {
  pollId: string;
  bookId: string;
  bookTitle: string;
  meetingId: string | null;
  // Every upcoming meeting, with or without a book.
  upcoming: MeetingDTO[];
  isAdmin: boolean;
}) => {
  const assign = useUpdateMeeting();
  const open = upcoming.filter((m) => m.bookId === null);
  const [choice, setChoice] = useState("");
  const picked = choice || open[0]?.id || "";

  if (meetingId) {
    const meeting = upcoming.find((m) => m.id === meetingId);
    return (
      <p className="poll-assigned">
        {meeting ? `Chosen for ${meetingLabel(meeting)}` : "Chosen for a meeting"}
        {" · "}
        <Link to={`/meetings/${meetingId}`}>See the meeting</Link>
      </p>
    );
  }
  if (!isAdmin) {
    return null;
  }
  // The new meeting form, with this poll's results as its book choices.
  const newMeeting = (
    <Link to={`/meetings/new?poll=${pollId}&book=${bookId}`}>
      New meeting for this book
    </Link>
  );
  if (open.length === 0) {
    return (
      <p className="poll-assigned muted">
        No upcoming meeting needs a book. {newMeeting}
      </p>
    );
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    assign.mutate({ id: picked, bookId });
  };

  const selectId = `assign-${bookId}`;
  return (
    <form className="assign-book" onSubmit={handleSubmit}>
      <label htmlFor={selectId} className="visually-hidden">
        Meeting for {bookTitle}
      </label>
      <select id={selectId} value={picked} onChange={(e) => setChoice(e.target.value)}>
        {open.map((m) => (
          <option key={m.id} value={m.id}>
            {meetingLabel(m)}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="button-primary"
        aria-label={`Assign ${bookTitle}`}
        disabled={assign.isPending}
      >
        {assign.isPending ? "Assigning..." : "Assign"}
      </button>
      {assign.error && <p role="alert">{assign.error.message}</p>}
      <p className="poll-assigned muted">Or: {newMeeting}</p>
    </form>
  );
};
