import { BookDTO, VoteDTO } from "shared";
import { NotFoundError } from "../lib/errors";

export const getIsOpen = (start: Date, end: Date): boolean => {
  const today = Date.now();
  const startTs = start.getTime();
  const endTs = end.getTime();
  return today >= startTs && today < endTs;
};

export const generatePollResults = (
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

export const getUserVotes = (
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

export const getVoterCount = (
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

export const buildPollDTO = (
  prismaPoll:
    | ({
        books: BookDTO[];
        votes: VoteDTO[];
      } & {
        createdAt: Date;
        id: string;
        closesAt: Date;
        votesPerMember: number;
        theme: string | null;
        opensAt: Date;
      })
    | null,
  userId: string,
) => {
  if (!prismaPoll) {
    throw new NotFoundError();
  }
  const myVotes = getUserVotes(prismaPoll.votes, userId);
  const isOpen = getIsOpen(prismaPoll.opensAt, prismaPoll.closesAt);
  const poll = {
    ...prismaPoll,
    myVotes,
    isOpen,
    voterCount: getVoterCount(prismaPoll.votes),
    results: generatePollResults(prismaPoll.votes, prismaPoll.books, isOpen),
  };
  return poll;
};
