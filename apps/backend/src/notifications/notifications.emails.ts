import { type NotificationKind } from "shared";
import { config } from "../lib/config";
import { type Email } from "../lib/email";
import {
  siteUrl,
  unsubscribeApiUrl,
  unsubscribePageUrl,
} from "./notifications.links";

// Every notification email: a short message, one button, and a footer that
// turns off just this kind of email. Plain inline styles, since many mail
// apps drop <style> blocks.

export type Recipient = { id: string; email: string; firstName: string };

// Titles, themes and venue names are typed in by members.
const escape = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const inClubTime = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { ...options, timeZone: config.CLUB_TIME_ZONE });

// "Thursday, November 13 at 7:00 PM"
const day = inClubTime({ weekday: "long", month: "long", day: "numeric" });
const time = inClubTime({ hour: "numeric", minute: "2-digit" });
export const when = (date: Date) => `${day.format(date)} at ${time.format(date)}`;

// The site's palette (styles.css): blush paper, plum ink, wine pink.
const C = {
  paper: "#fff6f7",
  surface: "#ffffff",
  ink: "#241b3a",
  soft: "#5e5470",
  line: "#f0dce3",
  accent: "#c81d6b",
  accentSoft: "#fce4ee",
};
// Fraunces and Figtree where the mail app loads web fonts (Apple Mail does,
// Gmail doesn't); Georgia and the system font everywhere else.
// Single quotes inside: these go into style="…" attributes.
const DISPLAY = `Fraunces, Georgia, 'Times New Roman', serif`;
const BODY = `Figtree, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif`;

const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px"><tr><td style="background:${C.accent};border-radius:999px">
<a href="${href}" style="display:inline-block;padding:13px 26px;color:#ffffff;font-family:${BODY};font-size:16px;font-weight:700;text-decoration:none;border-radius:999px">${label}</a>
</td></tr></table>`;

const heading = (text: string) =>
  `<h1 style="margin:0 0 12px;font-family:${DISPLAY};font-size:26px;line-height:1.2;font-weight:700;color:${C.ink}">${text}</h1>`;

const para = (html: string) => `<p style="margin:0 0 14px">${html}</p>`;

const FOOTER_REASON: Record<NotificationKind, string> = {
  NEW_POLL: "new book polls",
  VOTE_REMINDER: "reminders to vote",
  RSVP_REMINDER: "reminders to RSVP",
  MEETING_REMINDER: "meeting reminders",
};

// A blush page with a white card: the logo and wordmark on top, the message,
// then a small footer to turn this kind of email off. Tables, because that's
// what lays out the same in every mail app.
const layout = (
  to: Recipient,
  kind: NotificationKind,
  subject: string,
  body: string,
): Email => ({
  to: to.email,
  subject,
  html: `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Figtree:wght@400;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.paper}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px">
<tr><td style="padding:0 6px 16px">
<a href="${siteUrl("/")}" style="text-decoration:none;color:${C.ink}">
<img src="${siteUrl("/apple-touch-icon.png")}" width="36" height="36" alt="" style="vertical-align:middle;border-radius:9px;border:0">
<span style="vertical-align:middle;margin-left:8px;font-family:${DISPLAY};font-size:19px;font-weight:700;color:${C.ink}">Read Between <em style="color:${C.accent}">the</em> Wines</span>
</a>
</td></tr>
<tr><td style="background:${C.surface};border:1px solid ${C.line};border-radius:20px;padding:30px 28px;font-family:${BODY};font-size:16px;line-height:1.55;color:${C.ink}">
${body}
</td></tr>
<tr><td style="padding:18px 8px 0;font-family:${BODY};font-size:12px;line-height:1.5;color:${C.soft}">
You're getting this as a member of Read Between the Wines.
<a href="${unsubscribePageUrl(to.id, kind)}" style="color:${C.soft}">Stop emails about ${FOOTER_REASON[kind]}</a>
· <a href="${siteUrl("/profile")}" style="color:${C.soft}">Email settings</a>
</td></tr>
</table>
</td></tr></table>
</body></html>`,
  headers: {
    "List-Unsubscribe": `<${unsubscribeApiUrl(to.id, kind)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  },
});

const hi = (to: Recipient) => heading(`Hi ${escape(to.firstName)}!`);

export type PollForEmail = { id: string; closesAt: Date };

export const newPollEmail = (to: Recipient, poll: PollForEmail) =>
  layout(
    to,
    "NEW_POLL",
    "A new book poll is open",
    `${hi(to)}
${para("A new book poll is open! Help pick what we read next.")}
${para(`Voting closes <strong>${when(poll.closesAt)}</strong>.`)}
${button(siteUrl(`/polls/${poll.id}`), "Vote now")}`,
  );

export const voteReminderEmail = (to: Recipient, poll: PollForEmail) =>
  layout(
    to,
    "VOTE_REMINDER",
    "Don't forget to vote",
    `${hi(to)}
${para(`The book poll closes on <strong>${when(poll.closesAt)}</strong>. Don't forget to vote!`)}
${button(siteUrl(`/polls/${poll.id}`), "Vote now")}`,
  );

export type MeetingForEmail = {
  id: string;
  title: string;
  start: Date;
  book: { title: string; author: string } | null;
  venue: { name: string; streetAddress: string; city: string } | null;
};

// The book, when and where, in a soft pink box.
const details = (m: MeetingForEmail) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 4px"><tr>
<td style="background:${C.accentSoft};border-radius:14px;padding:16px 18px">
<div style="font-family:${DISPLAY};font-size:19px;font-weight:700;line-height:1.25">${escape(m.book?.title ?? m.title)}</div>
${m.book ? `<div style="font-style:italic;color:${C.soft};margin:2px 0 10px">${escape(m.book.author)}</div>` : `<div style="height:10px"></div>`}
<div>📅 ${when(m.start)}</div>
${m.venue ? `<div>📍 ${escape(m.venue.name)}, ${escape(m.venue.streetAddress)}, ${escape(m.venue.city)}</div>` : ""}
</td></tr></table>`;

export const rsvpReminderEmail = (to: Recipient, meeting: MeetingForEmail) =>
  layout(
    to,
    "RSVP_REMINDER",
    `Are you coming tomorrow? ${meeting.title}`,
    `${hi(to)}
${para("We meet tomorrow. Please let us know if you're coming.")}
${details(meeting)}
${button(siteUrl(`/meetings/${meeting.id}`), "RSVP")}`,
  );

// One email for members going or maybe going: the details, plus a nudge to
// say what food they're bringing if they haven't.
export const meetingReminderEmail = (
  to: Recipient,
  meeting: MeetingForEmail,
  { saidDish }: { saidDish: boolean },
) =>
  layout(
    to,
    "MEETING_REMINDER",
    `See you tomorrow: ${meeting.title}`,
    `${hi(to)}
${para("Just a reminder that we meet tomorrow.")}
${details(meeting)}
${
  saidDish
    ? button(siteUrl(`/meetings/${meeting.id}`), "See the meeting")
    : `${para(`<span style="display:block;margin-top:18px">Bringing something to eat or drink? Add it to the menu so we don't end up with five bags of chips.</span>`)}
${button(siteUrl(`/meetings/${meeting.id}`), "Add what you're bringing")}`
}`,
  );
