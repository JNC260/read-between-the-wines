import {
  BookCandidateDTO,
  BookDTO,
  SuggestedBookDTO,
  type CastVotesDTO,
  type CreatePollDTO,
  type PollDTO,
} from "shared";
import { prisma } from "../lib/prisma";
import { BadRequestError, ConflictError, NotFoundError } from "../lib/errors";

// Every function returns the poll from userId's point of view (myVotes), so
// the controller can send the same shape everywhere. polls.db.spec.ts says
// exactly what each rule returns.

// Admins only (the route checks). Every book must be a suggestion that isn't
// on a meeting yet, and no other poll may be open.
const getVoterCount = (
  allVotes: {
    userId: string;
    pollId: string;
    bookId: string;
    createdAt: Date;
  }[],
) => {
  const voterSet = new Set();
  for (const vote of allVotes) {
    if (!voterSet.has(vote.userId)) {
      voterSet.add(vote.userId);
    }
  }
  return voterSet.size;
};

const getUserVotes = (
  allVotes: {
    userId: string;
    pollId: string;
    bookId: string;
    createdAt: Date;
  }[],
  userId: string,
): string[] => {
  const userVotes = [];
  for (const vote of allVotes) {
    if (vote.userId === userId) {
      userVotes.push(vote.bookId);
    }
  }
  return userVotes;
};

const getIsOpen = (start: Date, end: Date): boolean => {
  const today = Date.now();
  const startTs = start.getTime();
  const endTs = end.getTime();
  return today >= startTs && today < endTs;
};

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

const validateBooks = async (bookIds: string[]) => {
  for (const bookId of bookIds) {
    await validateBookNotAssigned(bookId);
    await validateBookIsSuggested(bookId);
    await validateBookExists(bookId);
  }
};

const validateOnlyPollOpen = async () => {
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

const generatePollResults = (
  votes: {
    userId: string;
    pollId: string;
    bookId: string;
    createdAt: Date;
  }[],
  books: BookDTO[],
  isOpen: boolean,
) => {
  if (isOpen) {
    return null;
  }
  const resultMap = new Map<string, number>();
  for (const book of books) {
    resultMap.set(book.id, 0);
  }
  for (const vote of votes) {
    const existing = resultMap.get(vote.bookId) ?? 0;
    resultMap.set(vote.bookId, existing + 1);
  }
  const resultArray = Array.from(resultMap.entries()).map(([bookId, votes]) => {
    return { bookId, votes };
  });
  return resultArray.sort((a, b) => b.votes - a.votes);
};

export const createPoll = async (
  data: CreatePollDTO,
  userId: string,
): Promise<PollDTO> => {
  await validateBooks(data.bookIds);
  await validateOnlyPollOpen();
  const newPoll = await prisma.poll.create({
    data: {
      books: { connect: data.bookIds.map((id) => ({ id })) },
      opensAt: new Date(),
      closesAt: data.closesAt,
      theme: data.theme ?? null,
    },
    include: { books: true, votes: true },
  });
  const isOpen = getIsOpen(newPoll.opensAt, newPoll.closesAt);
  const pollResult = {
    ...newPoll,
    myVotes: [],
    isOpen,
    voterCount: 0,
    results: generatePollResults(newPoll.votes, newPoll.books, isOpen),
  };
  return pollResult;
};

// The poll that's open right now, or null.
export const getCurrentPoll = async (
  userId: string,
): Promise<PollDTO | null> => {
  const currentPollResult = await prisma.poll.findFirst({
    where: {
      opensAt: { lte: new Date() },
      closesAt: { gt: new Date() },
    },
    include: {
      votes: true,
      books: true,
    },
  });
  if (!currentPollResult) {
    return null;
  }
  const myVotes = getUserVotes(currentPollResult.votes, userId);
  const isOpen = getIsOpen(
    currentPollResult.opensAt,
    currentPollResult.closesAt,
  );
  const currentPoll = {
    myVotes,
    votesPerMember: currentPollResult.votesPerMember,
    isOpen: getIsOpen(currentPollResult.opensAt, currentPollResult.closesAt),
    voterCount: getVoterCount(currentPollResult.votes),
    id: currentPollResult.id,
    theme: currentPollResult.theme,
    opensAt: currentPollResult.opensAt,
    closesAt: currentPollResult.closesAt,
    createdAt: currentPollResult.createdAt,
    books: currentPollResult.books,
    results: generatePollResults(
      currentPollResult.votes,
      currentPollResult.books,
      isOpen,
    ),
  };
  return currentPoll;
};

// TODO: implement
export const getPoll = async (
  pollId: string,
  userId: string,
): Promise<PollDTO> => {
  const pollResult = await prisma.poll.findUnique({
    where: {
      id: pollId,
    },
    include: {
      votes: true,
      books: true,
    },
  });
  if (!pollResult) {
    throw new NotFoundError();
  }
  const myVotes = getUserVotes(pollResult.votes, userId);
  const isOpen = getIsOpen(pollResult.opensAt, pollResult.closesAt);
  const poll = {
    myVotes,
    votesPerMember: pollResult.votesPerMember,
    isOpen,
    voterCount: getVoterCount(pollResult.votes),
    id: pollResult.id,
    theme: pollResult.theme,
    opensAt: pollResult.opensAt,
    closesAt: pollResult.closesAt,
    createdAt: pollResult.createdAt,
    books: pollResult.books,
    votes: pollResult.votes,
    results: generatePollResults(pollResult.votes, pollResult.books, isOpen),
  };
  return poll;
};

// Replaces all of userId's votes on the poll.
export const castVotes = async (
  pollId: string,
  userId: string,
  data: CastVotesDTO,
): Promise<PollDTO> => {
  throw new Error("Not implemented");
};
