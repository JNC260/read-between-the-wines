import { BookSearchQuerySchema, CreateBookSuggestionSchema } from "./books";

describe("BookSearchQuerySchema", () => {
  it("trims q", () => {
    expect(BookSearchQuerySchema.parse({ q: "  circe " })).toEqual({ q: "circe" });
  });

  it.each([{}, { q: "" }, { q: "   " }, { q: "x".repeat(501) }])(
    "rejects %j",
    (query) => {
      expect(BookSearchQuerySchema.safeParse(query).success).toBe(false);
    },
  );
});

describe("CreateBookSuggestionSchema", () => {
  it("accepts a work id on its own", () => {
    expect(
      CreateBookSuggestionSchema.parse({ openLibraryWorkId: "OL27482W" }),
    ).toEqual({ openLibraryWorkId: "OL27482W" });
  });

  it("accepts and trims a Goodreads link", () => {
    expect(
      CreateBookSuggestionSchema.parse({
        openLibraryWorkId: "OL27482W",
        goodreadsUrl: " https://www.goodreads.com/book/show/5907.The_Hobbit ",
      }),
    ).toEqual({
      openLibraryWorkId: "OL27482W",
      goodreadsUrl: "https://www.goodreads.com/book/show/5907.The_Hobbit",
    });
  });

  it.each(["OL27482M", "/works/OL27482W", "27482", ""])(
    "rejects work id %j",
    (openLibraryWorkId) => {
      expect(
        CreateBookSuggestionSchema.safeParse({ openLibraryWorkId }).success,
      ).toBe(false);
    },
  );

  it("rejects a link that isn't a Goodreads book", () => {
    expect(
      CreateBookSuggestionSchema.safeParse({
        openLibraryWorkId: "OL27482W",
        goodreadsUrl: "https://openlibrary.org/works/OL27482W",
      }).success,
    ).toBe(false);
  });
});
