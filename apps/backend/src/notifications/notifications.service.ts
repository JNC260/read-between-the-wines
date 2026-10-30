import { NOTIFICATION_KINDS, type NotificationKind, type UnsubscribeQuery } from "shared";
import {
  Prisma,
  RsvpStatus,
  UserStatus,
} from "../../generated/prisma/client";
import { type Email, sendEmail } from "../lib/email";
import { NotFoundError } from "../lib/errors";
import { isProduction } from "../lib/config";
import { prisma } from "../lib/prisma";
import {
  meetingReminderEmail,
  newPollEmail,
  type Recipient,
  rsvpReminderEmail,
  voteReminderEmail,
} from "./notifications.emails";
import { isValidUnsubscribe } from "./notifications.links";

const DAY_MS = 24 * 60 * 60 * 1000;

// Resend allows a couple of requests a second, so production paces itself.
// A club's worth of emails takes seconds either way.
const SEND_GAP_MS = isProduction ? 600 : 0;
const pause = () => new Promise((r) => setTimeout(r, SEND_GAP_MS));

const recipientFields = { id: true, email: true, firstName: true } as const;

// Active members who haven't turned this kind of email off. Inactive,
// banned and legacy placeholder accounts are never emailed. `also` narrows
// it further, like "hasn't voted on this poll".
const recipients = (kind: NotificationKind, also: Prisma.UserWhereInput = {}) =>
  prisma.user.findMany({
    where: {
      status: UserStatus.ACTIVE,
      NOT: { emailOptOuts: { has: kind } },
      ...also,
    },
    select: recipientFields,
    orderBy: { createdAt: "asc" },
  });

// Claims the log row before sending, so two checks running at once can't
// both send it. If the send fails the claim is given back, and the next
// check tries again. Returns whether this call sent it.
const sendOnce = async (
  to: Recipient,
  kind: NotificationKind,
  subjectId: string,
  email: Email,
): Promise<boolean> => {
  try {
    await prisma.notificationLog.create({ data: { userId: to.id, kind, subjectId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return false;
    }
    throw e;
  }
  try {
    await sendEmail(email);
  } catch (e) {
    await prisma.notificationLog.deleteMany({ where: { userId: to.id, kind, subjectId } });
    throw e;
  }
  return true;
};

// One failed address doesn't stop everyone else's email.
const sendAll = async <T extends Recipient>(
  people: T[],
  kind: NotificationKind,
  subjectId: string,
  build: (to: T) => Email,
) => {
  let sent = 0;
  for (const to of people) {
    try {
      if (await sendOnce(to, kind, subjectId, build(to))) {
        sent++;
        await pause();
      }
    } catch (e) {
      console.error(`Failed to send ${kind} for ${subjectId} to user ${to.id}`, e);
    }
  }
  return sent;
};

// Right after a poll is created. Not awaited by the request that made it.
export const notifyNewPoll = async (pollId: string) => {
  const poll = await prisma.poll.findUnique({ where: { id: pollId } });
  if (!poll) {
    return 0;
  }
  return sendAll(await recipients("NEW_POLL"), "NEW_POLL", poll.id, (to) =>
    newPollEmail(to, poll),
  );
};

const meetingInclude = {
  book: { select: { title: true, author: true } },
  venue: { select: { name: true, streetAddress: true, city: true } },
} as const;

// Everything due in the next 24 hours. Safe to run as often as you like:
// the log makes sure each email goes out once. If the server was down when
// a reminder was due, it goes out on the next run, as long as the poll or
// meeting hasn't started or closed.
export const sendDueReminders = async (now = new Date()) => {
  const soon = new Date(now.getTime() + DAY_MS);
  let sent = 0;

  const polls = await prisma.poll.findMany({
    where: { closesAt: { gt: now, lte: soon }, opensAt: { lte: now } },
  });
  for (const poll of polls) {
    // A poll that's only open for a day or less just had its new poll email.
    if (poll.closesAt.getTime() - poll.opensAt.getTime() <= DAY_MS) {
      continue;
    }
    const notVoted = await recipients("VOTE_REMINDER", {
      votes: { none: { pollId: poll.id } },
    });
    sent += await sendAll(notVoted, "VOTE_REMINDER", poll.id, (to) =>
      voteReminderEmail(to, poll),
    );
  }

  const meetings = await prisma.meeting.findMany({
    where: { start: { gt: now, lte: soon }, cancelledAt: null },
    include: meetingInclude,
  });
  for (const meeting of meetings) {
    const noAnswer = await recipients("RSVP_REMINDER", {
      rsvps: { none: { meetingId: meeting.id } },
    });
    sent += await sendAll(noAnswer, "RSVP_REMINDER", meeting.id, (to) =>
      rsvpReminderEmail(to, meeting),
    );

    const coming = await prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        NOT: { emailOptOuts: { has: "MEETING_REMINDER" } },
        rsvps: {
          some: { meetingId: meeting.id, status: { in: [RsvpStatus.YES, RsvpStatus.MAYBE] } },
        },
      },
      select: { ...recipientFields, rsvps: { where: { meetingId: meeting.id }, select: { dish: true } } },
      orderBy: { createdAt: "asc" },
    });
    sent += await sendAll(coming, "MEETING_REMINDER", meeting.id, (to) =>
      meetingReminderEmail(to, meeting, { saidDish: !!to.rsvps[0]?.dish }),
    );
  }

  return sent;
};

// From the link in an email, without signing in. A bad signature gets the
// same 404 as an unknown member, so links can't be used to probe for ids.
export const unsubscribe = async ({ u, k, t }: UnsubscribeQuery) => {
  if (!isValidUnsubscribe(u, k, t)) {
    throw new NotFoundError("This unsubscribe link isn't valid");
  }
  const user = await prisma.user.findUnique({ where: { id: u }, select: { emailOptOuts: true } });
  if (!user) {
    throw new NotFoundError("This unsubscribe link isn't valid");
  }
  const optOuts = k === "ALL" ? [...NOTIFICATION_KINDS] : [...new Set([...user.emailOptOuts, k])];
  await prisma.user.update({ where: { id: u }, data: { emailOptOuts: optOuts } });
};
