import {
  BookSearchQuerySchema,
  CreateBookSuggestionSchema,
  UpdateBookSchema,
} from "./books";

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

describe("UpdateBookSchema", () => {
  it("accepts any subset of fields, trimming text", () => {
    expect(
      UpdateBookSchema.parse({ title: " Circe ", genres: ["Fantasy"] }),
    ).toEqual({ title: "Circe", genres: ["Fantasy"] });
  });

  it.each([
    ["a genre that isn't on the list", ["Fantasy", "Chick lit"]],
    ["more than three genres", ["Fantasy", "Horror", "Romance", "Humor"]],
    ["the same genre twice", ["Fantasy", "Fantasy"]],
  ])("rejects %s", (_, genres) => {
    expect(UpdateBookSchema.safeParse({ genres }).success).toBe(false);
  });

  it("leaves out the work id, which isn't editable", () => {
    expect(UpdateBookSchema.parse({ openLibraryWorkId: "OL27482W" })).toEqual({});
  });

  it("accepts null to clear an optional field", () => {
    expect(
      UpdateBookSchema.parse({ synopsis: null, coverUrl: null, yearPublished: null }),
    ).toEqual({ synopsis: null, coverUrl: null, yearPublished: null });
  });

  it.each([
    { title: "" },
    { title: null },
    { author: "   " },
    { synopsis: "" },
    { pageCount: -1 },
    { coverUrl: "ftp://example.com/cover.jpg" },
    { goodreadsUrl: "https://example.com" },
  ])("rejects %j", (body) => {
    expect(UpdateBookSchema.safeParse(body).success).toBe(false);
  });
});
