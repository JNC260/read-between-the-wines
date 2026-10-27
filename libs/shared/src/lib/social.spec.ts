import { handleUrl, isProfileUrl, parseHandle, parseProfileUrl } from "./social";

describe("parseHandle", () => {
  it.each([
    ["instagram", "jen"],
    ["instagram", "@jen"],
    ["instagram", " @jen "],
    ["instagram", "https://www.instagram.com/jen/"],
    ["instagram", "instagram.com/jen?igsh=abc"],
    ["tiktok", "https://www.tiktok.com/@jen"],
    ["tiktok", "@jen"],
    ["x", "https://x.com/jen"],
    ["x", "https://twitter.com/jen"],
    ["venmo", "https://venmo.com/u/jen"],
    ["venmo", "venmo.com/jen"],
  ] as const)("reads %s handle from %s", (site, input) => {
    expect(parseHandle(site, input)).toBe("jen");
  });

  it("keeps dots, dashes and underscores", () => {
    expect(parseHandle("venmo", "@Jen-Byers_2")).toBe("Jen-Byers_2");
  });

  it("leaves a link to another site alone, so validation rejects it", () => {
    expect(parseHandle("instagram", "https://facebook.com/jen")).toBe(
      "https://facebook.com/jen",
    );
  });

  it("leaves a link with no handle alone", () => {
    expect(parseHandle("instagram", "https://instagram.com/")).toBe(
      "https://instagram.com/",
    );
  });
});

describe("handleUrl", () => {
  it("builds each site's profile link", () => {
    expect(handleUrl("instagram", "jen")).toBe("https://www.instagram.com/jen");
    expect(handleUrl("tiktok", "jen")).toBe("https://www.tiktok.com/@jen");
    expect(handleUrl("x", "jen")).toBe("https://x.com/jen");
    expect(handleUrl("venmo", "jen")).toBe("https://venmo.com/u/jen");
  });
});

describe("parseProfileUrl", () => {
  it("adds https to a link without a scheme", () => {
    expect(parseProfileUrl("facebook", "facebook.com/jen")).toBe(
      "https://facebook.com/jen",
    );
  });

  it("upgrades http to https", () => {
    expect(
      parseProfileUrl("goodreads", "http://www.goodreads.com/user/show/123-jen"),
    ).toBe("https://www.goodreads.com/user/show/123-jen");
  });

  it("keeps the query string, which some Facebook links need", () => {
    expect(
      parseProfileUrl("facebook", "https://www.facebook.com/profile.php?id=100"),
    ).toBe("https://www.facebook.com/profile.php?id=100");
  });

  it.each([
    "https://instagram.com/jen",
    "https://facebook.com/",
    "https://notfacebook.com/jen",
    "jen",
  ])("leaves %s alone, so validation rejects it", (input) => {
    expect(isProfileUrl("facebook", parseProfileUrl("facebook", input))).toBe(
      false,
    );
  });
});
