import * as z from "zod";
import { parseGoodreadsUrl } from "../lib/goodreads";
import { isoDate } from "./dates";

// Open Library's id for a work, which groups every edition of a book.
export const openLibraryWorkId = z
  .string()
  .regex(/^OL\d+W$/, "Invalid Open Library work id");

export const BookSchema = z.object({
  id: z.uuidv4(),
  title: z.string(),
  author: z.string(),
  yearPublished: z.int().nullable(),
  genres: z.array(z.string()),
  coverUrl: z.string().nullable(),
  synopsis: z.string().nullable(),
  pageCount: z.int().nullable(),
  openLibraryWorkId: openLibraryWorkId.nullable(),
  goodreadsUrl: z.string().nullable(),
  createdAt: isoDate,
});

export type BookDTO = z.output<typeof BookSchema>;

// GET /books/:id. The whole book, synopsis included, for the edit page.
// canEdit: this member suggested it (alone or with others), or is an admin.
export const BookDetailSchema = BookSchema.extend({
  canEdit: z.boolean(),
});

export type BookDetailDTO = z.output<typeof BookDetailSchema>;

const goodreadsBookUrl = z
  .string()
  .trim()
  .refine((url) => parseGoodreadsUrl(url) !== null, "Not a Goodreads book link");

const requiredText = z.string().trim().min(1, "Required").max(300);
const optionalText = (max: number) => z.string().trim().min(1).max(max).nullable();

// PATCH /books/:id. For fixing a suggestion after the fact, so every field
// can change. null clears an optional field; leaving it out keeps it.
export const UpdateBookSchema = z
  .object({
    title: requiredText,
    author: requiredText,
    // Negative for BCE, for the occasional Odyssey.
    yearPublished: z.int().min(-3000).max(9999).nullable(),
    genres: z.array(z.string().trim().min(1).max(50)).max(20),
    coverUrl: z.url({ protocol: /^https?$/ }).nullable(),
    synopsis: optionalText(10_000),
    pageCount: z.int().min(1).max(20_000).nullable(),
    // Relinks the book to another Open Library work. Must stay unique.
    openLibraryWorkId: openLibraryWorkId.nullable(),
    goodreadsUrl: goodreadsBookUrl.nullable(),
  })
  .partial();

export type UpdateBookDTO = z.output<typeof UpdateBookSchema>;

// GET /books/search?q=. q is a pasted Goodreads link or a typed title; the
// server works out which.
export const BookSearchQuerySchema = z.object({
  q: z.string().trim().min(1, "Required").max(500),
});

export type BookSearchQuery = z.infer<typeof BookSearchQuerySchema>;

// One search result to pick from. No synopsis: Open Library only returns it
// per work, so it's fetched once, when a member picks a book.
export const BookCandidateSchema = z.object({
  openLibraryWorkId,
  title: z.string(),
  author: z.string(),
  yearPublished: z.int().nullable(),
  coverUrl: z.string().nullable(),
  pageCount: z.int().nullable(),
  // Some member has suggested this work; picking it adds this member's
  // suggestion to the same book.
  alreadySuggested: z.boolean(),
  // This member has suggested it, so the form shouldn't offer it again.
  suggestedByMe: z.boolean(),
});

export type BookCandidateDTO = z.output<typeof BookCandidateSchema>;

// POST /books/suggestions, after picking a search result. Only the work id is
// trusted from the client: the server looks the book up itself.
export const CreateBookSuggestionSchema = z.object({
  openLibraryWorkId,
  goodreadsUrl: goodreadsBookUrl.optional(),
});

export type CreateBookSuggestionDTO = z.infer<
  typeof CreateBookSuggestionSchema
>;

// Just enough to name a member next to a book or an RSVP; no email.
export const SuggesterSchema = z.object({
  id: z.uuidv4(),
  firstName: z.string(),
  lastName: z.string(),
});

export type SuggesterDTO = z.output<typeof SuggesterSchema>;

// GET /books/suggestions. One entry per book, however many members suggested
// it. Books already assigned to a meeting are left out.
export const SuggestedBookSchema = BookSchema.omit({ synopsis: true }).extend({
  suggestedBy: z.array(SuggesterSchema), // earliest first
  suggestedByMe: z.boolean(),
  suggestedAt: isoDate, // when the first member suggested it
});

export type SuggestedBookDTO = z.output<typeof SuggestedBookSchema>;

// GET /books/read. Books assigned to a meeting, with that meeting's date. The
// latest meeting may still be upcoming.
export const ReadBookSchema = BookSchema.omit({ synopsis: true }).extend({
  suggestedByMe: z.boolean(),
  meetingId: z.uuidv4(),
  meetingStart: isoDate,
  averageRating: z.number().nullable(), // null until someone rates it
  ratingCount: z.int(),
  myRating: z.int().nullable(),
});

export type ReadBookDTO = z.output<typeof ReadBookSchema>;

// PUT /books/:id/rating. Only books on a meeting can be rated; rating again
// replaces the member's earlier score.
export const RateBookSchema = z.object({
  score: z.int().min(1).max(5),
});

export type RateBookDTO = z.infer<typeof RateBookSchema>;

export const RatingSchema = z.object({
  bookId: z.uuidv4(),
  score: z.int(),
});

export type RatingDTO = z.output<typeof RatingSchema>;
