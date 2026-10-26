import { prisma } from "../lib/prisma";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
} from "../lib/errors";

const validateBookNotAssigned = async (bookId: string) => {
  const meeting = await prisma.meeting.findUnique({
    where: { bookId },
    include: { book: true },
  });
  if (meeting) {
    throw new BadRequestError(
      `${meeting.book?.title} has already been assigned to a meeting.`,
    );
  }
};

const validateBookIsSuggested = async (bookId: string) => {
  const suggestion = await prisma.suggestion.findFirst({ where: { bookId } });
  if (!suggestion) {
    throw new BadRequestError(
      `${bookId} has not been suggested for a meeting.`,
    );
  }
};

const validateBookExists = async (bookId: string) => {
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) {
    throw new NotFoundError();
  }
};

export const validateBooks = async (bookIds: string[]) => {
  for (const bookId of bookIds) {
    await validateBookNotAssigned(bookId);
    await validateBookIsSuggested(bookId);
    await validateBookExists(bookId);
  }
};

export const validateOnlyPollOpen = async () => {
  const openPolls = await prisma.poll.findMany({
    where: {
      opensAt: { lte: new Date() },
      closesAt: { gt: new Date() },
    },
  });

  if (openPolls.length > 0) {
    throw new ConflictError("There is already a poll open.");
  }
};

export const validateVote = async (pollId: string, bookIds: string[]) => {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { books: true },
  });
  if (!poll) {
    throw new NotFoundError();
  }
  if (bookIds.length > poll.votesPerMember) {
    throw new BadRequestError(
      `You are limited to ${poll.votesPerMember} votes.`,
    );
  }
  if (Date.now() < poll.opensAt.getTime()) {
    console.log("TOO EARLY NOW", Date.now(), "OPEN", poll.opensAt.getTime());
    throw new ForbiddenError("Poll is not open yet.");
  }
  if (Date.now() > poll.closesAt.getTime()) {
    console.log("TOO LATE NOW", Date.now(), "CLOSE", poll.closesAt.getTime());
    throw new ForbiddenError("Poll is now closed.");
  }
  const pollBookSet = new Set();
  for (const b of poll.books) {
    pollBookSet.add(b.id);
  }
  for (const bid of bookIds) {
    await validateBookExists(bid);
    if (!pollBookSet.has(bid)) {
      throw new BadRequestError("This book is not on the poll.");
    }
  }
};
