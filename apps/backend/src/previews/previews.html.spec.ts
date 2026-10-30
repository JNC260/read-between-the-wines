import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { withPreview } from "./previews.html";

// The real page, so a change to its tags can't quietly break the cards.
const index = readFileSync(
  fileURLToPath(new URL("../../../frontend/index.html", import.meta.url)),
  "utf8",
);

const content = (html: string, key: string) =>
  new RegExp(`<meta\\s+(?:property|name)="${key}"\\s+content="([^"]*)"`).exec(html)?.[1];

describe("withPreview", () => {
  const preview = {
    title: "Circe · Thu, Nov 13",
    description: "RSVP to the next meeting! Thursday, Nov 13, 7:00 PM.",
    url: "https://example.org/meetings/abc",
  };

  it("swaps the title, description and URL everywhere they appear", () => {
    const html = withPreview(index, preview);
    expect(html).toContain("<title>Circe · Thu, Nov 13</title>");
    for (const key of ["og:title", "twitter:title"]) {
      expect(content(html, key)).toBe(preview.title);
    }
    for (const key of ["description", "og:description", "twitter:description"]) {
      expect(content(html, key)).toBe(preview.description);
    }
    expect(content(html, "og:url")).toBe(preview.url);
  });

  it("keeps the site's image unless the preview has its own", () => {
    expect(content(withPreview(index, preview), "og:image")).toBe(content(index, "og:image"));

    const withCover = withPreview(index, {
      ...preview,
      image: "https://covers.openlibrary.org/b/id/1-L.jpg",
      imageAlt: "The cover of Circe",
    });
    expect(content(withCover, "og:image")).toBe("https://covers.openlibrary.org/b/id/1-L.jpg");
    expect(content(withCover, "twitter:image:alt")).toBe("The cover of Circe");
    // A cover isn't the site image's 1200x630, so its size tags go.
    expect(content(withCover, "og:image:width")).toBeUndefined();
  });

  it("escapes quotes and angle brackets from book titles", () => {
    const html = withPreview(index, { ...preview, title: `"Hi" <b>` });
    expect(content(html, "og:title")).toBe("&quot;Hi&quot; &lt;b&gt;");
  });
});
