import { type CastVotesDTO, type CreatePollDTO, type PollDTO } from "shared";
import { prisma } from "../lib/prisma";
import { ForbiddenError, NotFoundError } from "../lib/errors";

import {
  validateBooks,
  validateOnlyPollOpen,
  validateVote,
} from "./polls.validate";
import { getIsOpen, generatePollResults, buildPollDTO } from "./polls.helpers";

// Every function returns the poll from userId's point of view (myVotes), so
// the controller can send the same shape everywhere. polls.db.spec.ts says
// exactly what each rule returns.

export const createPoll = async (data: CreatePollDTO): Promise<PollDTO> => {
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
  return buildPollDTO(currentPollResult, userId);
};

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
  return buildPollDTO(pollResult, userId);
};

// Replaces all of userId's votes on the poll.
export const castVotes = async (
  pollId: string,
  userId: string,
  data: CastVotesDTO,
): Promise<PollDTO> => {
  await validateVote(pollId, data.bookIds);
  const updatedPoll = await prisma.poll.update({
    where: { id: pollId },
    data: {
      votes: {
        deleteMany: { userId },
        createMany: {
          data: data.bookIds.map((bookId) => ({ userId, bookId })),
          skipDuplicates: true,
        },
      },
    },
    include: { books: true, votes: true },
  });
  return buildPollDTO(updatedPoll, userId);
};
