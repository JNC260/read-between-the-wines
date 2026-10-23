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
  goodreadsUrl: z
    .string()
    .trim()
    .refine((url) => parseGoodreadsUrl(url) !== null, "Not a Goodreads book link")
    .optional(),
});

export type CreateBookSuggestionDTO = z.infer<typeof CreateBookSuggestionSchema>;
