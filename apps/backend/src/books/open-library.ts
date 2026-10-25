import * as z from "zod";

// What we read from Open Library. Only books.service uses these. Every field
// but key and title can be missing, so most are optional; z.object() drops
// anything we don't list.
// Docs: https://openlibrary.org/dev/docs/api/search

export const OPEN_LIBRARY_URL = "https://openlibrary.org";

// Open Library asks apps to identify themselves, ideally with a contact
// address, so they can get in touch instead of blocking us.
export const USER_AGENT = "ReadBetweenTheWines/0.1 (invite-only book club)";

// Pass as search.json's fields= so responses carry only what we map.
export const SEARCH_FIELDS = [
  "key",
  "title",
  "author_name",
  "first_publish_year",
  "cover_i",
  "number_of_pages_median",
].join(",");

// One result from GET /search.json. key looks like "/works/OL27482W".
export const SearchDocSchema = z.object({
  key: z.string(),
  title: z.string(),
  author_name: z.array(z.string()).optional(),
  first_publish_year: z.int().optional(),
  cover_i: z.int().optional(),
  number_of_pages_median: z.int().optional(),
});

export type SearchDoc = z.infer<typeof SearchDocSchema>;

export const SearchResponseSchema = z.object({
  docs: z.array(SearchDocSchema),
});

// GET /works/<id>.json. Only the synopsis is read from here. description is
// a plain string on some works and { type, value } on others.
export const WorkDescriptionSchema = z.object({
  description: z
    .union([z.string(), z.object({ value: z.string() })])
    .optional(),
});

export type WorkDescription = z.infer<typeof WorkDescriptionSchema>;
