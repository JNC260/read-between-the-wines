// books.service tests. fetch and Prisma are mocked, so no network or database
// is needed: each test queues the Open Library responses it expects, in call
// order, with respond().
import { Prisma } from "../../generated/prisma/client";
import { BadGatewayError, ConflictError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { createSuggestion, searchBooks } from "./books.service";
import { USER_AGENT } from "./open-library";
import {
  bareSearch,
  circeSearch,
  circeTitleSearch,
  noResults,
  workWithObjectDescription,
  workWithoutDescription,
  workWithStringDescription,
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

const USER_ID = "user-1";
const CIRCE_LINK = "https://www.goodreads.com/book/show/35959740-circe";
const CIRCE_WORK_ID = "OL18012166W";

// A Book row as Prisma returns it.
const circeBook = {
  id: "book-1",
  title: "Circe",
  normalizedTitle: "circe",
  author: "Madeline Miller",
  yearPublished: 2018,
  genres: [],
  coverUrl: "https://covers.openlibrary.org/b/id/8739376-L.jpg",
  synopsis: workWithStringDescription.description,
  pageCount: 404,
  openLibraryWorkId: CIRCE_WORK_ID,
  goodreadsUrl: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
};

// findMany's mock is typed without the include, so rows that carry
// suggestions are cast.
const mockExistingBooks = (
  rows: (typeof circeBook & { suggestions: unknown[] })[],
) => vi.mocked(prisma.book.findMany).mockResolvedValue(rows as never);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.book.findMany).mockResolvedValue([]);
  vi.mocked(prisma.book.upsert).mockResolvedValue(circeBook);
});

describe("searchBooks", () => {
  it("searches by Goodreads id for a pasted link", async () => {
    respond(circeSearch);
    await searchBooks(CIRCE_LINK, USER_ID);
    expect(fetchedUrl().searchParams.get("q")).toBe("id_goodreads:35959740");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to a title search with the slug when the id isn't found", async () => {
    respond(noResults);
    respond(circeTitleSearch);
    const candidates = await searchBooks(CIRCE_LINK, USER_ID);
    expect(fetchedUrl(1).searchParams.get("q")).toBe('title:"circe"');
    expect(candidates).toHaveLength(2);
  });

  it("returns [] for a link with no slug and no id match", async () => {
    respond(noResults);
    const candidates = await searchBooks(
      "https://www.goodreads.com/book/show/35959740",
      USER_ID,
    );
    expect(candidates).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prisma.book.findMany).not.toHaveBeenCalled();
  });

  it("searches by title for typed text", async () => {
    respond(circeTitleSearch);
    await searchBooks("circe miller", USER_ID);
    expect(fetchedUrl().searchParams.get("q")).toBe("circe miller");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps docs to candidates: work id, joined authors, cover URL, nulls", async () => {
    respond({
      docs: [
        ...circeSearch.docs,
        {
          key: "/works/OL2W",
          title: "Good Omens",
          author_name: ["Terry Pratchett", "Neil Gaiman"],
        },
        ...bareSearch.docs,
      ],
    });
    const candidates = await searchBooks("circe", USER_ID);
    expect(candidates).toEqual([
      {
        openLibraryWorkId: CIRCE_WORK_ID,
        title: "Circe",
        author: "Madeline Miller",
        yearPublished: 2018,
        coverUrl: "https://covers.openlibrary.org/b/id/8739376-L.jpg",
        pageCount: 404,
        alreadySuggested: false,
        suggestedByMe: false,
      },
      expect.objectContaining({
        openLibraryWorkId: "OL2W",
        author: "Terry Pratchett & Neil Gaiman",
      }),
      expect.objectContaining({
        openLibraryWorkId: "OL1W",
        yearPublished: null,
        coverUrl: null,
        pageCount: null,
      }),
    ]);
  });

  it('uses "Unknown author" when a doc has no authors', async () => {
    respond({
      docs: [
        ...bareSearch.docs,
        { key: "/works/OL3W", title: "Beowulf", author_name: [] },
      ],
    });
    const candidates = await searchBooks("untitled", USER_ID);
    expect(candidates.map((c) => c.author)).toEqual([
      "Unknown author",
      "Unknown author",
    ]);
  });

  it("flags works already in the Book table as alreadySuggested", async () => {
    respond(circeTitleSearch);
    mockExistingBooks([{ ...circeBook, suggestions: [] }]);
    const candidates = await searchBooks("circe", USER_ID);

    expect(prisma.book.findMany).toHaveBeenCalledWith({
      where: { openLibraryWorkId: { in: [CIRCE_WORK_ID, "OL21869269W"] } },
      include: { suggestions: { where: { userId: USER_ID } } },
    });
    expect(candidates.map((c) => c.alreadySuggested)).toEqual([true, false]);
    expect(candidates.map((c) => c.suggestedByMe)).toEqual([false, false]);
  });

  it("flags works this user suggested as suggestedByMe", async () => {
    respond(circeTitleSearch);
    mockExistingBooks([
      {
        ...circeBook,
        suggestions: [
          { userId: USER_ID, bookId: circeBook.id, createdAt: new Date() },
        ],
      },
    ]);
    const candidates = await searchBooks("circe", USER_ID);
    expect(candidates.map((c) => c.suggestedByMe)).toEqual([true, false]);
  });

  it("sends the User-Agent header", async () => {
    respond(circeSearch);
    await searchBooks("circe", USER_ID);
    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      "User-Agent": USER_AGENT,
    });
  });

  it("throws BadGatewayError when Open Library errors or is unreachable", async () => {
    respond({}, 500);
    await expect(searchBooks("circe", USER_ID)).rejects.toThrow(
      BadGatewayError,
    );

    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(searchBooks("circe", USER_ID)).rejects.toThrow(
      BadGatewayError,
    );

    fetchMock.mockResolvedValueOnce(new Response("<html>Down</html>"));
    await expect(searchBooks("circe", USER_ID)).rejects.toThrow(
      BadGatewayError,
    );
  });

  it("throws BadGatewayError when the response doesn't match the schema", async () => {
    respond({ error: "oops" });
    await expect(searchBooks("circe", USER_ID)).rejects.toThrow(
      BadGatewayError,
    );
  });
});

describe("createSuggestion", () => {
  it("throws NotFoundError for a work id Open Library doesn't know", async () => {
    respond(noResults);
    await expect(
      createSuggestion(USER_ID, { openLibraryWorkId: "OL999W" }),
    ).rejects.toThrow(NotFoundError);
    expect(prisma.book.upsert).not.toHaveBeenCalled();
  });

  it("upserts the book by work id with normalizedTitle and synopsis", async () => {
    respond(circeSearch);
    respond(workWithStringDescription);
    const book = await createSuggestion(USER_ID, {
      openLibraryWorkId: CIRCE_WORK_ID,
    });

    expect(fetchedUrl(0).searchParams.get("q")).toBe(
      `key:"/works/${CIRCE_WORK_ID}"`,
    );
    expect(fetchedUrl(1).pathname).toBe(`/works/${CIRCE_WORK_ID}.json`);
    expect(prisma.book.upsert).toHaveBeenCalledWith({
      where: { openLibraryWorkId: CIRCE_WORK_ID },
      update: { goodreadsUrl: undefined },
      create: {
        title: "Circe",
        normalizedTitle: "circe",
        author: "Madeline Miller",
        yearPublished: 2018,
        pageCount: 404,
        coverUrl: "https://covers.openlibrary.org/b/id/8739376-L.jpg",
        synopsis: workWithStringDescription.description,
        openLibraryWorkId: CIRCE_WORK_ID,
        goodreadsUrl: undefined,
      },
    });
    expect(book).toBe(circeBook);
  });

  it.each([
    ["a string", workWithStringDescription, workWithStringDescription.description],
    ["an object", workWithObjectDescription, workWithObjectDescription.description.value],
    ["missing", workWithoutDescription, null],
  ])("reads the synopsis when the description is %s", async (_, work, synopsis) => {
    respond(circeSearch);
    respond(work);
    await createSuggestion(USER_ID, { openLibraryWorkId: CIRCE_WORK_ID });
    expect(prisma.book.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ synopsis }),
      }),
    );
  });

  it("saves the goodreadsUrl when given", async () => {
    respond(circeSearch);
    respond(workWithStringDescription);
    await createSuggestion(USER_ID, {
      openLibraryWorkId: CIRCE_WORK_ID,
      goodreadsUrl: CIRCE_LINK,
    });
    expect(prisma.book.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { goodreadsUrl: CIRCE_LINK },
        create: expect.objectContaining({ goodreadsUrl: CIRCE_LINK }),
      }),
    );
  });

  it("adds a suggestion to an existing book instead of duplicating it", async () => {
    const existing = { ...circeBook, id: "existing-book" };
    vi.mocked(prisma.book.upsert).mockResolvedValue(existing);
    respond(circeSearch);
    respond(workWithStringDescription);

    const book = await createSuggestion(USER_ID, {
      openLibraryWorkId: CIRCE_WORK_ID,
    });

    expect(prisma.suggestion.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, bookId: "existing-book" },
    });
    expect(book).toBe(existing);
  });

  it("throws ConflictError when this user already suggested the book", async () => {
    respond(circeSearch);
    respond(workWithStringDescription);
    vi.mocked(prisma.suggestion.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7",
      }),
    );
    await expect(
      createSuggestion(USER_ID, { openLibraryWorkId: CIRCE_WORK_ID }),
    ).rejects.toThrow(ConflictError);
  });

  it("rethrows other database errors unchanged", async () => {
    respond(circeSearch);
    respond(workWithStringDescription);
    const fkError = new Prisma.PrismaClientKnownRequestError(
      "Foreign key constraint failed",
      { code: "P2003", clientVersion: "7" },
    );
    vi.mocked(prisma.suggestion.create).mockRejectedValue(fkError);
    await expect(
      createSuggestion(USER_ID, { openLibraryWorkId: CIRCE_WORK_ID }),
    ).rejects.toBe(fkError);
  });
});
