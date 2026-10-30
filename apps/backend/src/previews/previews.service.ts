import { cachedCoverUrl } from "../covers/covers.service";
import { config } from "../lib/config";
import { prisma } from "../lib/prisma";
import { type Preview } from "./previews.html";

// What a meeting or poll link's preview card says. Anyone holding the link
// can see the card, signed in or not, so it never includes the address, who
// is going, or how anyone voted: just the book, the date and a nudge.

const inClubTime = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { ...options, timeZone: config.CLUB_TIME_ZONE });
const shortDay = inClubTime({ weekday: "short", month: "short", day: "numeric" });
const dayAndTime = inClubTime({
  weekday: "long",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const MEETING_PATH = new RegExp(`^/meetings/(${UUID})/?$`, "i");
const POLL_PATH = new RegExp(`^/polls/(${UUID})/?$`, "i");

const meetingPreview = async (id: string, url: string): Promise<Preview | null> => {
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    select: {
      title: true,
      start: true,
      cancelledAt: true,
      book: { select: { title: true, author: true, coverUrl: true } },
    },
  });
  if (!meeting) {
    return null;
  }
  const { book } = meeting;
  const description = meeting.cancelledAt
    ? "This meeting was cancelled."
    : meeting.start < new Date()
      ? book
        ? `Read Between the Wines read ${book.title} by ${book.author}.`
        : "A past Read Between the Wines meeting."
      : `RSVP to the next meeting! ${dayAndTime.format(meeting.start)}.`;
  return {
    title: `${book?.title ?? meeting.title} · ${shortDay.format(meeting.start)}`,
    description,
    url,
    ...(book?.coverUrl && {
      image: cachedCoverUrl(book.coverUrl),
      imageAlt: `The cover of ${book.title} by ${book.author}`,
    }),
  };
};

const pollPreview = async (id: string, url: string): Promise<Preview | null> => {
  const poll = await prisma.poll.findUnique({
    where: { id },
    select: { opensAt: true, closesAt: true },
  });
  if (!poll) {
    return null;
  }
  const now = new Date();
  const open = poll.opensAt <= now && now < poll.closesAt;
  return open
    ? {
        title: "Vote for what we read next!",
        description: `Voting closes ${dayAndTime.format(poll.closesAt)}.`,
        url,
      }
    : {
        title: "The votes are in",
        description: "See what Read Between the Wines is reading next.",
        url,
      };
};

// The card for a page, or null for every page that keeps the site's own.
export const previewFor = async (pathname: string): Promise<Preview | null> => {
  const url = `${config.BETTER_AUTH_URL}${pathname}`;
  const meeting = MEETING_PATH.exec(pathname);
  if (meeting) {
    return meetingPreview(meeting[1], url);
  }
  const poll = POLL_PATH.exec(pathname);
  if (poll) {
    return pollPreview(poll[1], url);
  }
  return null;
};
