import { randomUUID } from "node:crypto";
import { normalizeTitle } from "shared";
import { prisma } from "../lib/prisma";

// Seeds rows straight through Prisma, so specs can set up any state
// (closed polls, existing votes) without going through the code under test.

// Empties every table but Prisma's migration history.
export const resetDb = async () => {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
  const names = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${names} CASCADE`);
};

export const createUser = (data: { firstName?: string; isAdmin?: boolean } = {}) => {
  const firstName = data.firstName ?? "Ada";
  return prisma.user.create({
    data: {
      name: `${firstName} Reader`,
      firstName,
      lastName: "Reader",
      email: `${randomUUID()}@example.com`,
      emailVerified: true,
      isAdmin: data.isAdmin ?? false,
    },
  });
};

// A book in the Book table. Pass suggestedBy to make it a suggestion.
export const createBook = async (
  data: { title?: string; suggestedBy?: string } = {},
) => {
  const title = data.title ?? `Book ${randomUUID().slice(0, 8)}`;
  return prisma.book.create({
    data: {
      title,
      normalizedTitle: normalizeTitle(title),
      author: "Some Author",
      synopsis: `What ${title} is about.`,
      goodreadsUrl: "https://www.goodreads.com/book/show/1",
      ...(data.suggestedBy && {
        suggestions: { create: { userId: data.suggestedBy } },
      }),
    },
  });
};

export const createMeeting = (bookId: string) =>
  prisma.meeting.create({
    data: {
      title: "Book club",
      start: new Date("2026-12-01T19:00:00Z"),
      end: new Date("2026-12-01T21:00:00Z"),
      bookId,
    },
  });

const DAY = 24 * 60 * 60 * 1000;

// Open by default: opened yesterday, closes in a week.
export const createPollRow = (data: {
  bookIds: string[];
  opensAt?: Date;
  closesAt?: Date;
  votesPerMember?: number;
}) =>
  prisma.poll.create({
    data: {
      opensAt: data.opensAt ?? new Date(Date.now() - DAY),
      closesAt: data.closesAt ?? new Date(Date.now() + 7 * DAY),
      votesPerMember: data.votesPerMember ?? 2,
      books: { connect: data.bookIds.map((id) => ({ id })) },
    },
  });

export const createClosedPollRow = (data: {
  bookIds: string[];
  votesPerMember?: number;
}) =>
  createPollRow({
    ...data,
    opensAt: new Date(Date.now() - 14 * DAY),
    closesAt: new Date(Date.now() - 7 * DAY),
  });

export const createVotes = (pollId: string, userId: string, bookIds: string[]) =>
  prisma.vote.createMany({
    data: bookIds.map((bookId) => ({ pollId, userId, bookId })),
  });

export const inDays = (days: number) => new Date(Date.now() + days * DAY);
