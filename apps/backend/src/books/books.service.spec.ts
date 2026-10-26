// books.service tests for searching Open Library. fetch and Prisma are
// mocked, so no network or database is needed: each test queues the Open
// Library responses it expects, in call order, with respond(). Everything that
// reads or writes the database is in books.db.spec.ts.
import { BadGatewayError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { searchBooks } from "./books.service";
import { USER_AGENT } from "./open-library";
import {
  bareSearch,
  circeSearch,
  circeTitleSearch,
  noResults,
} from "./open-library.fixtures";

// searchBooks checks the Book table for works already suggested. These tests
// leave it empty; books.db.spec.ts covers the flags.
vi.mock("../lib/prisma", () => ({
  prisma: { book: { findMany: vi.fn() } },
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

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.book.findMany).mockResolvedValue([]);
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
