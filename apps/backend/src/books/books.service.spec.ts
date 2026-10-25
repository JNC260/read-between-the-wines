// Scaffold for books.service tests. Turn each it.todo into an it() as you
// implement the service. fetch and Prisma are mocked, so no network or
// database is needed.
import { prisma } from "../lib/prisma";
import { createSuggestion, searchBooks } from "./books.service";
import {
  circeSearch,
  circeTitleSearch,
  noResults,
  workWithObjectDescription,
} from "./open-library.fixtures";

vi.mock("../lib/prisma", () => ({
  prisma: {
    book: { findMany: vi.fn(), upsert: vi.fn() },
    suggestion: { create: vi.fn() },
  },
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// Queue the next fetch response, in call order.
const respond = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status }),
  );

// The URL of the nth fetch call, for checking what was searched.
const fetchedUrl = (n = 0) => new URL(String(fetchMock.mock.calls[n][0]));

beforeEach(() => {
  vi.resetAllMocks();
});

// Example of the pattern, to copy once searchBooks works:
//
//   it("searches by Goodreads id for a pasted link", async () => {
//     respond(circeSearch);
//     vi.mocked(prisma.book.findMany).mockResolvedValue([]);
//     await searchBooks("https://www.goodreads.com/book/show/35959740-circe", "user-1");
//     expect(fetchedUrl().searchParams.get("q")).toBe("id_goodreads:35959740");
//   });
void [prisma, searchBooks, createSuggestion, respond, fetchedUrl];
void [circeSearch, circeTitleSearch, noResults, workWithObjectDescription];

describe("searchBooks", () => {
  it.todo("searches by Goodreads id for a pasted link");
  it.todo("falls back to a title search with the slug when the id isn't found");
  it.todo("returns [] for a link with no slug and no id match");
  it.todo("searches by title for typed text");
  it.todo("maps docs to candidates: work id, joined authors, cover URL, nulls");
  it.todo('uses "Unknown author" when a doc has no authors');
  it.todo("flags works already in the Book table as alreadySuggested");
  it.todo("flags works this user suggested as suggestedByMe");
  it.todo("sends the User-Agent header");
  it.todo("throws BadGatewayError when Open Library errors or is unreachable");
  it.todo("throws BadGatewayError when the response doesn't match the schema");
});

describe("createSuggestion", () => {
  it.todo("throws NotFoundError for a work id Open Library doesn't know");
  it.todo("upserts the book by work id with normalizedTitle and synopsis");
  it.todo("reads the synopsis from either description shape");
  it.todo("saves the goodreadsUrl when given");
  it.todo("adds a suggestion to an existing book instead of duplicating it");
  it.todo("throws ConflictError when this user already suggested the book");
});
