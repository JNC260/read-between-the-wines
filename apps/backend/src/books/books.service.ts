/* eslint-disable @typescript-eslint/no-unused-vars -- scaffold; delete once the TODOs are done */
import {
  type BookCandidateDTO,
  type BookDTO,
  type CreateBookSuggestionDTO,
  normalizeTitle,
  parseGoodreadsUrl,
} from "shared";
import { BadGatewayError, ConflictError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import {
  OPEN_LIBRARY_URL,
  SEARCH_FIELDS,
  type SearchDoc,
  SearchResponseSchema,
  USER_AGENT,
  type Work,
  WorkSchema,
} from "./open-library";

// ---------------------------------------------------------------------------
// Exported: called by books.controller
// ---------------------------------------------------------------------------

// q is a pasted Goodreads link or a typed title (already trimmed, non-empty).
export const searchBooks = async (
  q: string,
  userId: string,
): Promise<BookCandidateDTO[]> => {
  // TODO:
  // 1. parseGoodreadsUrl(q). If it's a link, search Open Library with
  //    `id_goodreads:<goodreadsId>`.
  // 2. No link, or the id search found nothing: search by title instead,
  //    using titleHint for a link or q itself for typed text. A link with no
  //    titleHint and no id match just returns [].
  // 3. Look up which of the result works are already in our Book table, and
  //    which of those this user has suggested: one findMany with
  //    `openLibraryWorkId: { in: [...] }`, including suggestions for userId.
  // 4. Map each doc with toCandidate().
  throw new Error("Not implemented");
};

export const createSuggestion = async (
  userId: string,
  data: CreateBookSuggestionDTO,
): Promise<BookDTO> => {
  // TODO:
  // 1. Look the work up yourself: search with `key:"/works/<id>"`. No doc
  //    means a bad id: throw NotFoundError.
  // 2. Fetch the synopsis with fetchWork().
  // 3. Find or create the Book by openLibraryWorkId. prisma.book.upsert()
  //    does both, and avoids a race where two members pick the same new
  //    book at once. Remember normalizedTitle: normalizeTitle(title). On
  //    the update side, think about what (if anything) to overwrite.
  // 4. Create the Suggestion. If this user already suggested the book,
  //    throw ConflictError. Either check first, or catch Prisma's P2002
  //    unique-violation error from the create.
  // 5. Return the book.
  throw new Error("Not implemented");
};

// ---------------------------------------------------------------------------
// Open Library calls
// ---------------------------------------------------------------------------

// GET /search.json?q=<query>&fields=SEARCH_FIELDS&limit=<limit>
const searchOpenLibrary = async (
  query: string,
  limit = 10,
): Promise<SearchDoc[]> => {
  // TODO:
  // - Build the URL with new URL(...) and url.searchParams.set(), which
  //   escapes quotes and spaces for you.
  // - fetch() with headers: { "User-Agent": USER_AGENT }.
  // - Network failure (fetch throws), !res.ok, or a body that fails
  //   SearchResponseSchema.safeParse() should all become BadGatewayError.
  //   Consider AbortSignal.timeout(...) so a slow Open Library can't hang
  //   the request.
  // - q= searches title and author together, so "circe miller" works.
  //   Fielded queries go in q too: id_goodreads:5907, key:"/works/OL27482W".
  throw new Error("Not implemented");
};

// GET /works/<id>.json
const fetchWork = async (workId: string): Promise<Work> => {
  // TODO: same error handling as searchOpenLibrary, parsing with WorkSchema.
  throw new Error("Not implemented");
};

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

// "/works/OL27482W" -> "OL27482W"
const workIdFromKey = (key: string): string => {
  // TODO
  throw new Error("Not implemented");
};

// Large cover by cover id. Use the id form, not /b/isbn/, which is rate
// limited: https://covers.openlibrary.org/b/id/<coverId>-L.jpg
const coverUrlFor = (coverId: number | undefined): string | null => {
  // TODO
  throw new Error("Not implemented");
};

// Normalizes Work.description's two shapes into one string, or null.
const synopsisFrom = (work: Work): string | null => {
  // TODO
  throw new Error("Not implemented");
};

const toCandidate = (
  doc: SearchDoc,
  flags: { alreadySuggested: boolean; suggestedByMe: boolean },
): BookCandidateDTO => {
  // TODO: author_name is an array (possibly missing). Missing numbers
  // become null, since the DTO uses null, not undefined.
  throw new Error("Not implemented");
};
