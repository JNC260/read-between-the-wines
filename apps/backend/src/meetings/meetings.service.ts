import {
  type CreateMeetingDTO,
  type MeetingDTO,
  type MeetingListQuery,
  type MeetingRsvpsDTO,
  type RsvpStatus,
  type UpdateMeetingDTO,
} from "shared";
import { BadRequestError, ConflictError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";

const include = { venue: true, book: true } as const;

// A meeting still in progress counts as upcoming. Upcoming lists soonest
// first; past lists most recent first, which is how people scan each.
export const getAllMeetings = ({
  when,
}: MeetingListQuery): Promise<MeetingDTO[]> => {
  const now = new Date();
  if (when === "upcoming") {
    return prisma.meeting.findMany({
      where: { end: { gte: now } },
      orderBy: { start: "asc" },
      include,
    });
  }
  if (when === "past") {
    return prisma.meeting.findMany({
      where: { end: { lt: now } },
      orderBy: { start: "desc" },
      include,
    });
  }
  return prisma.meeting.findMany({ orderBy: { start: "asc" }, include });
};

export const getMeeting = async (id: string): Promise<MeetingDTO> => {
  const meeting = await prisma.meeting.findUnique({ where: { id }, include });
  if (!meeting) {
    throw new NotFoundError("Meeting not found");
  }
  return meeting;
};

// Checked up front so a bad id is a 400/409 with a clear message, not a
// foreign key or unique constraint error from Postgres.
const checkReferences = async (
  meetingId: string | null,
  { venueId, bookId }: { venueId?: string | null; bookId?: string | null },
) => {
  if (venueId && !(await prisma.venue.findUnique({ where: { id: venueId } }))) {
    throw new BadRequestError("Venue not found");
  }
  if (bookId) {
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: { meeting: true },
    });
    if (!book) {
      throw new BadRequestError("Book not found");
    }
    if (book.meeting && book.meeting.id !== meetingId) {
      throw new ConflictError("That book is already assigned to a meeting");
    }
  }
};

export const createMeeting = async (
  data: CreateMeetingDTO,
): Promise<MeetingDTO> => {
  await checkReferences(null, data);
  return prisma.meeting.create({ data, include });
};

export const updateMeeting = async (
  id: string,
  data: UpdateMeetingDTO,
): Promise<MeetingDTO> => {
  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting) {
    throw new NotFoundError("Meeting not found");
  }
  const start = data.start ?? meeting.start;
  const end = data.end ?? meeting.end;
  if (end <= start) {
    throw new BadRequestError("End must be after start");
  }
  await checkReferences(id, data);
  return prisma.meeting.update({ where: { id }, data, include });
};

const findMeeting = async (id: string) => {
  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting) {
    throw new NotFoundError("Meeting not found");
  }
  return meeting;
};

// Every answer, from userId's point of view (myStatus).
export const getRsvps = async (
  meetingId: string,
  userId: string,
): Promise<MeetingRsvpsDTO> => {
  await findMeeting(meetingId);
  const rsvps = await prisma.rsvp.findMany({
    where: { meetingId },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  return {
    myStatus: rsvps.find((r) => r.userId === userId)?.status ?? null,
    rsvps: rsvps.map((r) => ({ member: r.user, status: r.status })),
  };
};

// Members can answer, or change their answer, until the meeting ends.
export const setRsvp = async (
  meetingId: string,
  userId: string,
  status: RsvpStatus,
): Promise<MeetingRsvpsDTO> => {
  const meeting = await findMeeting(meetingId);
  if (meeting.end < new Date()) {
    throw new BadRequestError("This meeting is over");
  }
  await prisma.rsvp.upsert({
    where: { userId_meetingId: { userId, meetingId } },
    create: { userId, meetingId, status },
    update: { status },
  });
  return getRsvps(meetingId, userId);
};
