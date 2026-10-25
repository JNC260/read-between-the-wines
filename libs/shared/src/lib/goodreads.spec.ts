import { parseGoodreadsUrl } from "./goodreads";

describe("parseGoodreadsUrl", () => {
  it("parses a dash-style slug", () => {
    expect(
      parseGoodreadsUrl("https://www.goodreads.com/book/show/35959740-circe"),
    ).toEqual({ goodreadsId: "35959740", titleHint: "circe" });
  });

  it("parses a dot-style slug with underscores", () => {
    expect(
      parseGoodreadsUrl("https://www.goodreads.com/book/show/5907.The_Hobbit"),
    ).toEqual({ goodreadsId: "5907", titleHint: "The Hobbit" });
  });

  it("parses a link with no slug", () => {
    expect(parseGoodreadsUrl("https://www.goodreads.com/book/show/5907")).toEqual(
      { goodreadsId: "5907", titleHint: null },
    );
  });

  it.each([
    "https://www.goodreads.com/en/book/show/35959740-circe",
    "https://www.goodreads.com/book/show/35959740-circe?ref=nav_sb_ss_1_5&from_search=true",
    "https://www.goodreads.com/book/show/35959740-circe/",
    "https://www.goodreads.com/book/show/35959740-circe#reviews",
    "http://goodreads.com/book/show/35959740-circe",
    "https://m.goodreads.com/book/show/35959740-circe",
    "www.goodreads.com/book/show/35959740-circe",
    "  https://www.goodreads.com/book/show/35959740-circe  ",
    "HTTPS://WWW.GOODREADS.COM/book/show/35959740-circe",
  ])("handles %j", (input) => {
    expect(parseGoodreadsUrl(input)).toEqual({
      goodreadsId: "35959740",
      titleHint: "circe",
    });
  });

  it("decodes percent-encoded slugs", () => {
    expect(
      parseGoodreadsUrl(
        "https://www.goodreads.com/book/show/42-the-handmaid%27s-tale",
      ),
    ).toEqual({ goodreadsId: "42", titleHint: "the handmaid's tale" });
  });

  it.each([
    ["an empty string", ""],
    ["not a URL", "circe by madeline miller"],
    ["another site", "https://openlibrary.org/book/show/35959740-circe"],
    ["a lookalike host", "https://notgoodreads.com/book/show/35959740-circe"],
    ["a Goodreads author page", "https://www.goodreads.com/author/show/7357817.Madeline_Miller"],
    ["a Goodreads series page", "https://www.goodreads.com/series/66175-the-hobbit"],
    ["a book link without an id", "https://www.goodreads.com/book/show/circe"],
  ])("returns null for %s", (_label, input) => {
    expect(parseGoodreadsUrl(input)).toBeNull();
  });
});
