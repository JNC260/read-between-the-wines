import {
  type CastVotesDTO,
  type CreatePollDTO,
  MAX_POLL_BOOKS,
  type PollDTO,
  type UpdatePollDTO,
} from "shared";
import { BadRequestError, ConflictError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { notifyNewPoll } from "../notifications/notifications.service";

import {
  validateBooks,
  validateOnlyPollOpen,
  validateVote,
} from "./polls.validate";
import { buildPollDTO, getIsOpen, pollInclude } from "./polls.helpers";

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
      votesPerMember: data.votesPerMember,
      theme: data.theme ?? null,
    },
    include: pollInclude,
  });
  // Emailed to members in the background, so creating the poll doesn't
  // wait on dozens of sends.
  notifyNewPoll(newPoll.id).catch((e) =>
    console.error("Emailing the new poll failed", e),
  );
  // A brand-new poll: nobody has voted, so the creator's view is everyone's.
  return buildPollDTO(newPoll, "");
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
    include: pollInclude,
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
    include: pollInclude,
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
    include: pollInclude,
  });
  return buildPollDTO(updatedPoll, userId);
};

// The newest poll, open or closed, or null before the first one. The landing
// page shows it: the ballot while it's open, the results once it closes.
export const getLatestPoll = async (
  userId: string,
): Promise<PollDTO | null> => {
  const poll = await prisma.poll.findFirst({
    orderBy: { createdAt: "desc" },
    include: pollInclude,
  });
  return poll && buildPollDTO(poll, userId);
};

// Admins only (the route checks). Nothing here changes a member's votes:
// see UpdatePollSchema for the rules.
export const updatePoll = async (
  pollId: string,
  userId: string,
  data: UpdatePollDTO,
): Promise<PollDTO> => {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { books: true, votes: true },
  });
  if (!poll) {
    throw new NotFoundError();
  }

  const isOpen = getIsOpen(poll.opensAt, poll.closesAt);
  // A later closing time on a closed poll opens it again, which is only
  // allowed while no other poll is open.
  const reopening = !isOpen && data.closesAt !== undefined;
  if (reopening) {
    await validateOnlyPollOpen(pollId);
  }
  const changesBallot =
    (data.addBookIds?.length ?? 0) > 0 || data.votesPerMember !== undefined;
  if (changesBallot && !isOpen && !reopening) {
    throw new BadRequestError(
      "Voting has closed. Reopen the poll to change the ballot.",
    );
  }

  const addBookIds = data.addBookIds ?? [];
  const onBallot = new Set(poll.books.map((b) => b.id));
  const already = addBookIds.find((id) => onBallot.has(id));
  if (already) {
    const book = poll.books.find((b) => b.id === already);
    throw new ConflictError(`${book?.title} is already on the ballot.`);
  }
  await validateBooks(addBookIds);
  const bookCount = poll.books.length + addBookIds.length;
  if (bookCount > MAX_POLL_BOOKS) {
    throw new BadRequestError(`A ballot can have at most ${MAX_POLL_BOOKS} books.`);
  }

  const votesPerMember = data.votesPerMember ?? poll.votesPerMember;
  if (votesPerMember >= bookCount) {
    throw new BadRequestError(
      "Votes per member must be fewer than the number of books",
    );
  }
  // Fewer votes than a member has already cast would mean dropping some.
  const votesByMember = new Map<string, number>();
  for (const v of poll.votes) {
    votesByMember.set(v.userId, (votesByMember.get(v.userId) ?? 0) + 1);
  }
  const mostUsed = Math.max(0, ...votesByMember.values());
  if (votesPerMember < mostUsed) {
    throw new BadRequestError(
      `A member has already used ${mostUsed} votes, so each member needs at least ${mostUsed}.`,
    );
  }

  const updated = await prisma.poll.update({
    where: { id: pollId },
    data: {
      theme: data.theme,
      closesAt: data.closesAt,
      votesPerMember: data.votesPerMember,
      books: { connect: addBookIds.map((id) => ({ id })) },
    },
    include: pollInclude,
  });
  return buildPollDTO(updated, userId);
};

// Admins only. Ends voting now; the results show straight away.
export const closePoll = async (
  pollId: string,
  userId: string,
): Promise<PollDTO> => {
  const poll = await prisma.poll.findUnique({ where: { id: pollId } });
  if (!poll) {
    throw new NotFoundError();
  }
  if (!getIsOpen(poll.opensAt, poll.closesAt)) {
    throw new ConflictError("This poll has already closed.");
  }
  const closed = await prisma.poll.update({
    where: { id: pollId },
    data: { closesAt: new Date() },
    include: pollInclude,
  });
  return buildPollDTO(closed, userId);
};
