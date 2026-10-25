/* eslint-disable @typescript-eslint/no-unused-vars -- scaffold; delete once the TODOs are done */
import {
  type BookCandidateDTO,
  type BookDTO,
  type CreateBookSuggestionDTO,
  normalizeTitle,
  openLibraryWorkId,
  parseGoodreadsUrl,
} from "shared";
import {
  BadGatewayError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../lib/errors";
import { prisma } from "../lib/prisma";
import {
  OPEN_LIBRARY_URL,
  SEARCH_FIELDS,
  type SearchDoc,
  SearchResponseSchema,
  USER_AGENT,
  type WorkDescription,
  WorkDescriptionSchema,
} from "./open-library";
import { Prisma, Suggestion } from "../../generated/prisma/client";

// How the three "search-ish" functions fit together:
//
//   searchBooks        Exported, called by the controller (GET /books/search?q=).
//                      The smart one: works out whether q is a Goodreads link or
//                      typed text, picks the query, checks our Book table, and
//                      maps results with toCandidate().
//   searchOpenLibrary  Plain HTTP call to /search.json. Returns docs with title,
//                      author, year, cover, pages and key, but NO synopsis.
//                      Used by searchBooks and createSuggestion.
//   fetchWork          Plain HTTP call to /works/<id>.json. Only used for the
//                      synopsis (description). Used by createSuggestion.
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
    const suggestedByMe = existingMap.get(workId)?.length ?? 0 > 0;
    return toCandidate(sr, {
      alreadySuggested,
      suggestedByMe: Boolean(suggestedByMe),
    });
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

  try {
    await prisma.suggestion.create({
      data: { userId, bookId: book.id },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new ConflictError();

    throw e;
  }

  return book;
};

// ---------------------------------------------------------------------------
// Open Library calls
// ---------------------------------------------------------------------------

// GET /search.json?q=<query>&fields=SEARCH_FIELDS&limit=<limit>
const searchOpenLibrary = async (
  query: string,
  limit = 10,
): Promise<SearchDoc[]> => {
  const searchUrl = new URL(`${OPEN_LIBRARY_URL}/search.json`);
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("fields", SEARCH_FIELDS);
  searchUrl.searchParams.set("limit", String(limit));

  let searchResponse: Response;
  try {
    searchResponse = await fetch(searchUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new BadGatewayError();
  }
  if (!searchResponse.ok) {
    throw new BadGatewayError();
  }

  let body: unknown;
  try {
    body = await searchResponse.json();
  } catch {
    throw new BadGatewayError();
  }

  const result = SearchResponseSchema.safeParse(body);
  if (result.error) {
    throw new BadGatewayError();
  }
  return result.data.docs;
};

// GET /works/<id>.json
const fetchWorkDescription = async (
  workId: string,
): Promise<WorkDescription> => {
  // No answer at all (network down, DNS, timeout): fetch throws.
  let workDescriptionResponse: Response;
  try {
    workDescriptionResponse = await fetch(
      `${OPEN_LIBRARY_URL}/works/${workId}.json`,
      {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(5000),
      },
    );
  } catch {
    throw new BadGatewayError();
  }

  // An answer, but an error status (404, 500): fetch returned normally.
  if (!workDescriptionResponse.ok) {
    throw new BadGatewayError();
  }

  // A body that isn't JSON (e.g. an HTML error page): .json() throws.
  let body: unknown;
  try {
    body = await workDescriptionResponse.json();
  } catch {
    throw new BadGatewayError();
  }

  // JSON, but the wrong shape: safeParse returns an error instead of throwing.
  const description = WorkDescriptionSchema.safeParse(body);
  if (description.error) {
    throw new BadGatewayError();
  }
  return description.data;
};

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

// "/works/OL27482W" -> "OL27482W"
const workIdFromKey = (key: string): string => {
  return key.split("/")[2];
};

// Large cover by cover id. Use the id form, not /b/isbn/, which is rate
// limited: https://covers.openlibrary.org/b/id/<coverId>-L.jpg
const coverUrlFor = (coverId: number | undefined): string | null => {
  if (!coverId) {
    return null;
  } else {
    return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
  }
};

// Normalizes Work.description's two shapes into one string, or null.
const synopsisFrom = (work: WorkDescription): string | null => {
  if (typeof work.description === "string") {
    return work.description;
  } else {
    return work.description?.value ?? null;
  }
};

const formatAuthors = (authorsArray: string[]) => {
  let author = "Unknown author";
  if (authorsArray.length === 1) {
    author = authorsArray[0];
  } else if (authorsArray.length > 1) {
    author = authorsArray.join(" & ");
  }
  return author;
};

const toCandidate = (
  doc: SearchDoc,
  flags: { alreadySuggested: boolean; suggestedByMe: boolean },
): BookCandidateDTO => {
  const author = formatAuthors(doc.author_name ?? []);
  const coverUrl = coverUrlFor(doc.cover_i);
  const openLibraryWorkId = workIdFromKey(doc.key);

  const bookCandidate: BookCandidateDTO = {
    openLibraryWorkId,
    title: normalizeTitle(doc.title),
    author,
    yearPublished: doc.first_publish_year ?? null,
    coverUrl,
    pageCount: doc.number_of_pages_median ?? null,
    alreadySuggested: flags.alreadySuggested,
    suggestedByMe: flags.suggestedByMe,
  };

  return bookCandidate;
};
