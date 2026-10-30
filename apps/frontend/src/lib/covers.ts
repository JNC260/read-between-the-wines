const OPEN_LIBRARY_COVERS = "https://covers.openlibrary.org/b/id/";

// Open Library covers load through the site's own copy (/api/covers), which
// is fast and cached for good; Open Library itself can take seconds per
// cover. Any other cover link, like one pasted on the edit page, is used as
// it is.
export const coverSrc = (coverUrl: string) =>
  coverUrl.startsWith(OPEN_LIBRARY_COVERS)
    ? `/api/covers/${coverUrl.slice(OPEN_LIBRARY_COVERS.length)}`
    : coverUrl;
