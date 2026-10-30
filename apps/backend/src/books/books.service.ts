import {
  type BookCandidateDTO,
  type BookDetailDTO,
  type BookDTO,
  type CreateBookSuggestionDTO,
  type Genre,
  type ManualBookSuggestionDTO,
  normalizeTitle,
  type RatingDTO,
  type ReadBookDTO,
  type SuggestedBookDTO,
  parseGoodreadsUrl,
  type UpdateBookDTO,
} from "shared";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../lib/errors";
import { prisma } from "../lib/prisma";
import {
  coverUrlFor,
  fetchWorkDescription,
  formatAuthors,
  type SearchDoc,
  searchOpenLibrary,
  synopsisFrom,
  workIdFromKey,
} from "./open-library";
import { Prisma, type Suggestion } from "../../generated/prisma/client";
import { pickGenres } from "./genres";

// How the three "search-ish" functions fit together:
//
//   searchBooks           Exported, called by the controller (GET
//                         /books/search?q=). The smart one: works out whether
//                         q is a Goodreads link or typed text, picks the
//                         query, checks our Book table, and maps results with
//                         toCandidate().
//   searchOpenLibrary     Plain HTTP call to /search.json. Returns docs with
//                         title, author, year, cover, pages and key, but NO
//                         synopsis. Used by searchBooks and createSuggestion.
//   fetchWorkDescription  Plain HTTP call to /works/<id>.json. Only used for
//                         the synopsis (description). Used by
//                         createSuggestion.
//
// searchOpenLibrary and fetchWorkDescription live in open-library.ts.
//
// All Goodreads-link parsing happens in searchBooks. createSuggestion never
// parses the link: by then the member has already picked a candidate.

// ---------------------------------------------------------------------------
// Exported: called by books.controller
// ---------------------------------------------------------------------------

// q is a pasted Goodreads link or a typed title (already trimmed, non-empty).
export const searchBooks = async (
  q: string,
  userId: string,
): Promise<BookCandidateDTO[]> => {
  const parsedUrl = parseGoodreadsUrl(q);
  const goodreadsId = parsedUrl?.goodreadsId;
  const titleHint = parsedUrl?.titleHint;

  let searchResult: SearchDoc[] = [];
  if (goodreadsId) {
    searchResult = await searchOpenLibrary(`id_goodreads:${goodreadsId}`);
  }
  if (searchResult.length === 0 && titleHint) {
    searchResult = await searchOpenLibrary(`title:"${titleHint}"`);
  }
  if (!goodreadsId && !titleHint) {
    searchResult = await searchOpenLibrary(q);
  }
  if (searchResult.length === 0) {
    return [];
  }

  const workIds: string[] = searchResult.map((sr) => workIdFromKey(sr.key));

  const existingBooks = await prisma.book.findMany({
    where: { openLibraryWorkId: { in: workIds } },
    include: { suggestions: { where: { userId } } },
  });

  const existingMap = new Map<string, Suggestion[]>();

  existingBooks.forEach((eb) => {
    if (!existingMap.has(eb.openLibraryWorkId ?? "")) {
      existingMap.set(eb.openLibraryWorkId ?? "", eb.suggestions);
    }
  });

  const candidates = searchResult.map((sr) => {
    const workId = workIdFromKey(sr.key);
    const alreadySuggested = existingMap.has(workId);
    const suggestedByMe = (existingMap.get(workId)?.length ?? 0) > 0;
    return toCandidate(sr, { alreadySuggested, suggestedByMe });
  });
  return candidates;
};

// By the time this runs, the member has searched and clicked a candidate. The
// client sends that candidate's openLibraryWorkId (always present: the schema
// requires it) and, if they pasted one, the goodreadsUrl. Only the work id is
// trusted, so the server looks the book up again itself.
export const createSuggestion = async (
  userId: string,
  data: CreateBookSuggestionDTO,
): Promise<BookDTO> => {
  const works = await searchOpenLibrary(
    `key:"/works/${data.openLibraryWorkId}"`,
  );
  if (works.length === 0) {
    throw new NotFoundError();
  }
  const work = works[0];
  const workDescription = await fetchWorkDescription(data.openLibraryWorkId);
  const synopsis = synopsisFrom(workDescription);
  const normalizedTitle = normalizeTitle(work.title);
  const author = formatAuthors(work.author_name ?? []);
  const coverUrl = coverUrlFor(work.cover_i);

  const book = await prisma.book.upsert({
    where: { openLibraryWorkId: data.openLibraryWorkId },
    update: {
      goodreadsUrl: data.goodreadsUrl,
    },
    create: {
      normalizedTitle,
      synopsis: synopsis,
      goodreadsUrl: data.goodreadsUrl,
      title: work.title,
      author,
      yearPublished: work.first_publish_year,
      pageCount: work.number_of_pages_median,
      openLibraryWorkId: data.openLibraryWorkId,
      coverUrl,
    },
  });

  await addSuggestion(userId, book.id);
  if (book.genres.length === 0) {
    tagInBackground(book.id, workDescription.subjects);
  }
  return book;
};

// For a book Open Library doesn't have, typed in by the member. There's no
// work id to match on, so the same book is spotted by its normalized title
// and author, any case. A match keeps its own details: this only adds the
// member's suggestion to it.
export const createManualSuggestion = async (
  userId: string,
  data: ManualBookSuggestionDTO,
): Promise<BookDTO> => {
  const normalizedTitle = normalizeTitle(data.title);
  const existing = await prisma.book.findFirst({
    where: {
      normalizedTitle,
      author: { equals: data.author, mode: "insensitive" },
    },
    orderBy: { createdAt: "asc" },
  });
  const book =
    existing ??
    (await prisma.book.create({ data: { ...data, normalizedTitle } }));

  await addSuggestion(userId, book.id);
  if (book.genres.length === 0) {
    tagInBackground(book.id, []);
  }
  return book;
};

// Takes back this member's suggestion, which only the book's one suggester
// can do. The book leaves the suggestions list, but its row stays: old polls
// and votes still point at it, and suggesting it again brings it back.
export const withdrawSuggestion = async (userId: string, bookId: string) => {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      suggestions: { select: { userId: true } },
      meeting: { select: { id: true } },
      polls: {
        where: { opensAt: { lte: new Date() }, closesAt: { gt: new Date() } },
        select: { id: true },
      },
    },
  });
  if (!book) {
    throw new NotFoundError();
  }
  if (!book.suggestions.some((s) => s.userId === userId)) {
    throw new NotFoundError("You haven't suggested this book");
  }
  if (book.suggestions.length > 1) {
    throw new ConflictError(
      "Other members suggested this book too, so it stays on the list",
    );
  }
  if (book.meeting) {
    throw new ConflictError("This book is already on a meeting");
  }
  if (book.polls.length > 0) {
    throw new ConflictError("This book is on the open poll");
  }
  await prisma.suggestion.delete({
    where: { userId_bookId: { userId, bookId } },
  });
};

// The AI's genres for a book, without saving them, or null when AI is off.
// subjects are Open Library's, when the caller has them.
export const genresFor = async (
  bookId: string,
  subjects: string[],
): Promise<Genre[] | null> => {
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
  return pickGenres({ ...book, subjects });
};

// Every book, oldest first, for the tag-genres script.
export const listBooksForTagging = () =>
  prisma.book.findMany({
    select: { id: true, title: true, genres: true, openLibraryWorkId: true },
    orderBy: { createdAt: "asc" },
  });

// updateMany, so a book deleted in the meantime is a no-op, not an error.
export const setGenres = async (bookId: string, genres: Genre[]) => {
  await prisma.book.updateMany({ where: { id: bookId }, data: { genres } });
};

// Books with at least one suggestion that aren't on a meeting yet, newest
// suggestion first. The frontend can re-sort; this is just the default.
export const listSuggestions = async (
  userId: string,
): Promise<SuggestedBookDTO[]> => {
  const books = await prisma.book.findMany({
    where: { suggestions: { some: {} }, meeting: { is: null } },
    include: {
      suggestions: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, image: true } },
        },
      },
    },
  });

  return books
    .map(({ suggestions, ...book }) => ({
      ...book,
      suggestedBy: suggestions.map((s) => s.user),
      suggestedByMe: suggestions.some((s) => s.userId === userId),
      // The where clause guarantees at least one, oldest first.
      suggestedAt: suggestions[0].createdAt,
    }))
    .sort((a, b) => b.suggestedAt.getTime() - a.suggestedAt.getTime());
};

// Books the club has read (or is about to), latest meeting first, with their
// ratings summed up. Queried from the meeting side so the sort happens in the
// database.
export const listReadBooks = async (userId: string): Promise<ReadBookDTO[]> => {
  const meetings = await prisma.meeting.findMany({
    where: { bookId: { not: null } },
    orderBy: { start: "desc" },
    include: {
      book: {
        include: {
          ratings: { select: { userId: true, score: true } },
          suggestions: { where: { userId }, select: { userId: true } },
        },
      },
    },
  });

  return meetings.flatMap(({ id, start, book }) => {
    if (!book) {
      return [];
    }
    const { ratings, suggestions, ...rest } = book;
    const total = ratings.reduce((sum, r) => sum + r.score, 0);
    return [
      {
        ...rest,
        suggestedByMe: suggestions.length > 0,
        meetingId: id,
        meetingStart: start,
        averageRating: ratings.length > 0 ? total / ratings.length : null,
        ratingCount: ratings.length,
        myRating: ratings.find((r) => r.userId === userId)?.score ?? null,
      },
    ];
  });
};

// Who's asking, for the edit check. Better Auth types isAdmin as optional.
type Viewer = { id: string; isAdmin?: boolean | null };

// Anyone who suggested a book can edit it, even when others suggested it
// too; admins can edit any book.
export const getBook = async (
  viewer: Viewer,
  bookId: string,
): Promise<BookDetailDTO> => {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: { suggestions: { where: { userId: viewer.id }, select: { userId: true } } },
  });
  if (!book) {
    throw new NotFoundError("Book not found");
  }
  const { suggestions, ...rest } = book;
  return { ...rest, canEdit: !!viewer.isAdmin || suggestions.length > 0 };
};

// For the "that's not what I meant" fixes. A new title gets a new
// normalizedTitle, which duplicate checks rely on.
export const updateBook = async (
  viewer: Viewer,
  bookId: string,
  data: UpdateBookDTO,
): Promise<BookDTO> => {
  const { canEdit } = await getBook(viewer, bookId);
  if (!canEdit) {
    throw new ForbiddenError(
      "Only members who suggested this book, or an admin, can edit it",
    );
  }

  return prisma.book.update({
    where: { id: bookId },
    data: {
      ...data,
      ...(data.title && { normalizedTitle: normalizeTitle(data.title) }),
    },
  });
};

// Same rule as the read-books page: a book counts as read once it's on a
// meeting. Rating again overwrites the member's earlier score.
export const rateBook = async (
  userId: string,
  bookId: string,
  score: number,
): Promise<RatingDTO> => {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: { meeting: true },
  });
  if (!book) {
    throw new NotFoundError("Book not found");
  }
  if (!book.meeting) {
    throw new ForbiddenError("Only books the club has read can be rated");
  }

  return prisma.rating.upsert({
    where: { userId_bookId: { userId, bookId } },
    update: { score },
    create: { userId, bookId, score },
  });
};

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

const toCandidate = (
  doc: SearchDoc,
  flags: { alreadySuggested: boolean; suggestedByMe: boolean },
): BookCandidateDTO => {
  const author = formatAuthors(doc.author_name ?? []);
  const coverUrl = coverUrlFor(doc.cover_i);
  const openLibraryWorkId = workIdFromKey(doc.key);

  const bookCandidate: BookCandidateDTO = {
    openLibraryWorkId,
    title: doc.title,
    author,
    yearPublished: doc.first_publish_year ?? null,
    coverUrl,
    pageCount: doc.number_of_pages_median ?? null,
    alreadySuggested: flags.alreadySuggested,
    suggestedByMe: flags.suggestedByMe,
  };

  return bookCandidate;
};

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

// The member's suggestion of a book. A member can only suggest a book once.
const addSuggestion = async (userId: string, bookId: string) => {
  try {
    await prisma.suggestion.create({ data: { userId, bookId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ConflictError();
    }
    throw e;
  }
};

// Tags a new book once its suggestion is saved. The member doesn't wait for
// it, and a failure only means the book has no genres until the next
// tag-genres run.
const tagInBackground = (bookId: string, subjects: string[]) => {
  const tag = async () => {
    const genres = await genresFor(bookId, subjects);
    if (genres && genres.length > 0) {
      await setGenres(bookId, genres);
    }
  };
  tag().catch((e) => console.error("Tagging genres failed:", e));
};
