// The key used to spot the same book suggested twice when there's no Open
// Library work id to compare (manual entries). Stored on Book as
// normalizedTitle, so changing these rules means backfilling existing rows.
export function normalizeTitle(title: string): string {
  const collapsed = title.trim().replace(/\s+/g, " ").toLowerCase();
  // Only a whole leading article with something after it: "Anna Karenina"
  // and a book titled just "A" are left alone.
  return collapsed.replace(/^(the|an|a) (?=\S)/, "");
}
