import { useState } from "react";
import { Link } from "react-router-dom";
import { type MeetingDTO } from "shared";
import { useCancelMeeting, useRestoreMeeting } from "../hooks";
import ShareToWhatsApp from "./ShareToWhatsApp";

const day = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "short",
  day: "numeric",
});
const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

// The RSVP reminder an admin posts in the club's group chat. *bold* and
// _italic_ are WhatsApp's formatting; the link gets the meeting's own
// preview card.
const rsvpReminder = (m: MeetingDTO) =>
  [
    "*📅 RSVP to the next meeting!*",
    m.book ? `*${m.book.title}* by _${m.book.author}_` : `*${m.title}*`,
    `${day.format(m.start)} · ${time.format(m.start)}`,
    ...(m.venue ? [m.venue.name] : []),
    "",
    `👉 ${window.location.origin}/meetings/${m.id}`,
  ].join("\n");

// The admin's tools on a meeting page: edit or cancel it, or restore it once
// cancelled. Cancelling asks once first, right here.
const MeetingAdminActions = ({ meeting }: { meeting: MeetingDTO }) => {
  const cancel = useCancelMeeting();
  const restore = useRestoreMeeting();
  const [confirming, setConfirming] = useState(false);
  const isOver = meeting.end < new Date();

  if (meeting.cancelledAt) {
    return (
      <div className="meeting-admin">
        <button
          type="button"
          className="button-quiet"
          disabled={restore.isPending}
          onClick={() => restore.mutate(meeting.id)}
        >
          {restore.isPending ? "Restoring..." : "Restore meeting"}
        </button>
        {restore.error && <p role="alert">{restore.error.message}</p>}
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="card meeting-admin-confirm" role="group" aria-label="Cancel meeting">
        <p>
          Cancel this meeting? It stays listed, marked cancelled, and members can't
          RSVP.
          {meeting.book &&
            ` ${meeting.book.title} goes back to the suggestions so it can go on another meeting.`}
        </p>
        {cancel.error && <p role="alert">{cancel.error.message}</p>}
        <div className="meeting-admin-buttons">
          <button
            type="button"
            className="button-primary"
            disabled={cancel.isPending}
            onClick={() =>
              cancel.mutate(meeting.id, { onSuccess: () => setConfirming(false) })
            }
          >
            {cancel.isPending ? "Cancelling..." : "Cancel meeting"}
          </button>
          <button type="button" className="button-quiet" onClick={() => setConfirming(false)}>
            Keep it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="meeting-admin">
      <Link to={`/meetings/${meeting.id}/edit`} className="button-link button-quiet">
        Edit meeting
      </Link>
      {!isOver && (
        <>
          <button type="button" className="button-quiet" onClick={() => setConfirming(true)}>
            Cancel meeting
          </button>
          <ShareToWhatsApp text={rsvpReminder(meeting)} label="Remind on WhatsApp" />
        </>
      )}
    </div>
  );
};

export default MeetingAdminActions;
