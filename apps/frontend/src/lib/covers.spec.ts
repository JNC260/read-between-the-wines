import { coverSrc } from "./covers";

describe("coverSrc", () => {
  it("loads Open Library covers through the site's own copy", () => {
    expect(coverSrc("https://covers.openlibrary.org/b/id/8739376-L.jpg")).toBe(
      "/api/covers/8739376-L.jpg",
    );
  });

  it("leaves other cover links alone", () => {
    expect(coverSrc("https://example.org/cover.jpg")).toBe("https://example.org/cover.jpg");
  });
});
