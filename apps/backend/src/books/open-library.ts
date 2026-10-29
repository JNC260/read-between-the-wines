import * as z from "zod";
import { BadGatewayError } from "../lib/errors";

// What we read from Open Library, and the calls that read it. Every field
// but key and title can be missing, so most are optional; z.object() drops
// anything we don't list.
// Docs: https://openlibrary.org/dev/docs/api/search

export const OPEN_LIBRARY_URL = "https://openlibrary.org";

// Open Library asks apps to identify themselves, ideally with a contact
// address, so they can get in touch instead of blocking us.
export const USER_AGENT = "ReadBetweenTheWines/0.1 (invite-only book club)";

// Pass as search.json's fields= so responses carry only what we map.
export const SEARCH_FIELDS = [
  "key",
  "title",
  "author_name",
  "first_publish_year",
  "cover_i",
  "number_of_pages_median",
].join(",");

// One result from GET /search.json. key looks like "/works/OL27482W".
export const SearchDocSchema = z.object({
  key: z.string(),
  title: z.string(),
  author_name: z.array(z.string()).optional(),
  first_publish_year: z.int().optional(),
  cover_i: z.int().optional(),
  number_of_pages_median: z.int().optional(),
});

export type SearchDoc = z.infer<typeof SearchDocSchema>;

export const SearchResponseSchema = z.object({
  docs: z.array(SearchDocSchema),
});

// GET /works/<id>.json. Only the synopsis is read from here. description is
// a plain string on some works and { type, value } on others.
export const WorkDescriptionSchema = z.object({
  description: z
    .union([z.string(), z.object({ value: z.string() })])
    .optional(),
});

export type WorkDescription = z.infer<typeof WorkDescriptionSchema>;

// ---------------------------------------------------------------------------
// Open Library calls
// ---------------------------------------------------------------------------

// GET /search.json?q=<query>&fields=SEARCH_FIELDS&limit=<limit>
export const searchOpenLibrary = async (
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
export const fetchWorkDescription = async (
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
export const workIdFromKey = (key: string): string => {
  return key.split("/")[2];
};

// Large cover by cover id. Use the id form, not /b/isbn/, which is rate
// limited: https://covers.openlibrary.org/b/id/<coverId>-L.jpg
export const coverUrlFor = (coverId: number | undefined): string | null => {
  if (!coverId) {
    return null;
  } else {
    return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
  }
};

// Normalizes Work.description's two shapes into one string, or null.
export const synopsisFrom = (work: WorkDescription): string | null => {
  if (typeof work.description === "string") {
    return work.description;
  } else {
    return work.description?.value ?? null;
  }
};

export const formatAuthors = (authorsArray: string[]) => {
  let author = "Unknown author";
  if (authorsArray.length === 1) {
    author = authorsArray[0];
  } else if (authorsArray.length > 1) {
    author = authorsArray.join(" & ");
  }
  return author;
};
