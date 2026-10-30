import { type MeetingDTO } from "shared";
import { googleCalendarUrl, icsFile } from "../lib/calendar";

// Saves the .ics file without a round trip to the server.
const download = (meeting: MeetingDTO) => {
  const url = URL.createObjectURL(
    new Blob([icsFile(meeting)], { type: "text/calendar;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${meeting.title.replace(/[^\w -]+/g, "").trim() || "meeting"}.ics`;
  link.click();
  URL.revokeObjectURL(url);
};

const AddToCalendar = ({ meeting }: { meeting: MeetingDTO }) => (
  <div className="add-to-calendar" role="group" aria-label="Add to your calendar">
    <span className="add-to-calendar-label">Add to calendar</span>
    <a
      href={googleCalendarUrl(meeting)}
      target="_blank"
      rel="noreferrer"
      className="button-link button-quiet"
    >
      Google
    </a>
    <button type="button" className="button-quiet" onClick={() => download(meeting)}>
      Apple or Outlook
    </button>
  </div>
);

export default AddToCalendar;
