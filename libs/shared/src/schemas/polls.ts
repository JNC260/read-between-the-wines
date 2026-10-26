import * as z from "zod";
import { BookSchema } from "./books";
import { isoDate } from "./dates";

export const MIN_POLL_BOOKS = 2;
export const MAX_POLL_BOOKS = 6;

const distinctBookIds = z
  .array(z.uuidv4())
  .refine((ids) => new Set(ids).size === ids.length, "Pick each book only once");

// POST /polls (admins). The poll opens as soon as it's created. Members vote
// for fewer books than are on the ballot, or the vote couldn't narrow it down.
export const CreatePollSchema = z
  .object({
    bookIds: distinctBookIds
      .min(MIN_POLL_BOOKS, `Pick at least ${MIN_POLL_BOOKS} books`)
      .max(MAX_POLL_BOOKS, `Pick at most ${MAX_POLL_BOOKS} books`),
    closesAt: isoDate,
    votesPerMember: z.int().min(1, "Members need at least one vote"),
    theme: z.string().trim().min(1).max(100).nullish(),
  })
  .refine((p) => p.closesAt > new Date(), {
    message: "Closing time must be in the future",
    path: ["closesAt"],
  })
  .refine((p) => p.votesPerMember < p.bookIds.length, {
    message: "Votes per member must be fewer than the number of books",
    path: ["votesPerMember"],
  });

export type CreatePollDTO = z.output<typeof CreatePollSchema>;

// PUT /polls/:id/votes. Replaces all of this member's votes on the poll. The
// poll's own limit (votesPerMember) is checked by the server.
export const CastVotesSchema = z.object({
  bookIds: distinctBookIds.min(1, "Pick at least one book"),
});

export type CastVotesDTO = z.output<typeof CastVotesSchema>;

export const PollResultSchema = z.object({
  bookId: z.uuidv4(),
  votes: z.int(),
});

export type PollResultDTO = z.output<typeof PollResultSchema>;

// What every poll endpoint returns, from the signed-in member's point of view.
export const PollSchema = z.object({
  id: z.uuidv4(),
  theme: z.string().nullable(),
  opensAt: isoDate,
  closesAt: isoDate,
  votesPerMember: z.int(),
  createdAt: isoDate,
  // opensAt <= now < closesAt
  isOpen: z.boolean(),
  // The ballot, with synopses so members can decide without clicking away.
  books: z.array(BookSchema),
  // Book ids this member voted for; [] if they haven't voted.
  myVotes: z.array(z.uuidv4()),
  // How many members have voted (not how many votes were cast).
  voterCount: z.int(),
  // Hidden from everyone, admins included, until the poll closes. Then one
  // entry per book on the ballot (0 if nobody picked it), most votes first.
  results: z.array(PollResultSchema).nullable(),
});

export type PollDTO = z.output<typeof PollSchema>;

// GET /polls/current: the open poll, or null when there isn't one.
export const CurrentPollSchema = PollSchema.nullable();
