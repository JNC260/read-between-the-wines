export type GoodreadsLink = {
  // Goodreads ids are per edition; Open Library can map them to a work
  goodreadsId: string;
  // Words from the URL slug, for a title search when Open Library doesn't
  // know the id. Null when the link has no slug.
  titleHint: string | null;
};

// Book links come as /book/show/35959740-circe, /book/show/5907.The_Hobbit,
// with a locale prefix (/en/book/show/...), with no slug, or with a query
// string or trailing slash. Returns null for anything that isn't a Goodreads
// book link.
export function parseGoodreadsUrl(input: string): GoodreadsLink | null {
  const trimmed = input.trim();
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (host !== "goodreads.com" && !host.endsWith(".goodreads.com")) {
    return null;
  }

  const match = url.pathname.match(
    /^(?:\/[a-z]{2})?\/book\/show\/(\d+)(?:[.-]([^/]+))?\/?$/i,
  );
  if (!match) {
    return null;
  }

  const [, goodreadsId, slug] = match;
  return { goodreadsId, titleHint: slug ? slugToWords(slug) : null };
}

function slugToWords(slug: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    decoded = slug;
  }
  const words = decoded.replace(/[-_]+/g, " ").trim();
  return words || null;
}
