import { type MeetingDTO } from "shared";

// "Add to calendar" for a meeting: a Google Calendar link, and an .ics file
// that Apple Calendar, Outlook and most others open.

const pageUrl = (meeting: MeetingDTO) =>
  `${window.location.origin}/meetings/${meeting.id}`;

const where = (meeting: MeetingDTO) => {
  const v = meeting.venue;
  return v ? `${v.name}, ${v.streetAddress}, ${v.city}, ${v.state} ${v.zip}` : "";
};

const about = (meeting: MeetingDTO) =>
  [
    meeting.book && `We're discussing ${meeting.book.title} by ${meeting.book.author}.`,
    meeting.description,
    `Details and RSVPs: ${pageUrl(meeting)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

// 20261113T190000Z: UTC, so every calendar shows it in its own time zone.
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export const googleCalendarUrl = (meeting: MeetingDTO) => {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: meeting.title,
    dates: `${utcStamp(meeting.start)}/${utcStamp(meeting.end)}`,
    details: about(meeting),
    location: where(meeting),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
};

// Commas, semicolons and backslashes are special in .ics text; newlines are
// written as \n.
const icsText = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");

// .ics lines should be at most 75 characters; longer ones carry on in lines
// that start with a space.
const fold = (line: string) =>
  line.length <= 75
    ? line
    : [line.slice(0, 75), ...(line.slice(75).match(/.{1,74}/g) ?? [])].join("\r\n ");

export const icsFile = (meeting: MeetingDTO) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Read Between the Wines//Meetings//EN",
    "BEGIN:VEVENT",
    // The same UID every time, so adding it twice updates the one event.
    `UID:${meeting.id}@readbetweenthewines`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(meeting.start)}`,
    `DTEND:${utcStamp(meeting.end)}`,
    `SUMMARY:${icsText(meeting.title)}`,
    `DESCRIPTION:${icsText(about(meeting))}`,
    ...(meeting.venue ? [`LOCATION:${icsText(where(meeting))}`] : []),
    `URL:${pageUrl(meeting)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n") + "\r\n";
