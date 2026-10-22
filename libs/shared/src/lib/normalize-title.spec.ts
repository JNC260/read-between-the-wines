import { normalizeTitle } from "./normalize-title";

describe("normalizeTitle", () => {
  it("lowercases", () => {
    expect(normalizeTitle("CIRCE")).toBe("circe");
  });

  it("trims and collapses repeated whitespace, including tabs and newlines", () => {
    expect(normalizeTitle("  Station \t Eleven\n ")).toBe("station eleven");
  });

  it.each([
    ["The Hobbit", "hobbit"],
    ["A Little Life", "little life"],
    ["An Absolutely Remarkable Thing", "absolutely remarkable thing"],
    ["  THE   Secret History ", "secret history"],
  ])("drops a leading article: %j", (title, expected) => {
    expect(normalizeTitle(title)).toBe(expected);
  });

  it("drops only one leading article", () => {
    expect(normalizeTitle("The A-Team")).toBe("a-team");
  });

  it.each(["Anna Karenina", "Atonement", "Theory of Everything", "Thermodynamics"])(
    "keeps words that only start like an article: %j",
    (title) => {
      expect(normalizeTitle(title)).toBe(title.toLowerCase());
    },
  );

  it("keeps articles that aren't at the start", () => {
    expect(normalizeTitle("Into the Wild")).toBe("into the wild");
  });

  it("keeps a title that is only an article", () => {
    expect(normalizeTitle("The")).toBe("the");
    expect(normalizeTitle(" A ")).toBe("a");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeTitle("   ")).toBe("");
  });
});
