import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod";
import { type Genre, GENRES, MAX_GENRES } from "shared";
import { AI_MODEL, anthropic } from "../lib/ai";

export type BookForGenres = {
  title: string;
  author: string;
  synopsis: string | null;
  // Open Library's subjects for the work: noisy, but full of hints.
  subjects: string[];
};

// Structured output holds the answer to the list. The count is checked here
// rather than in the schema, so a fourth genre is dropped, not an error.
const AnswerSchema = z.object({ genres: z.array(z.enum(GENRES)) });

const SYSTEM = `You tag books for a book club's catalog, so members can filter the books they might read next.

Pick the genres a member would look under to find this book, from this list only:
${GENRES.map((g) => `- ${g}`).join("\n")}

Pick 1 to ${MAX_GENRES}, best fit first. One or two is usually right; add a third only when the book really is that much of each. Use "Contemporary fiction" for present-day fiction that no other genre describes. Use "Psychological fiction" when the book is driven by its characters' inner lives and states of mind. Use "Classics" for long-established classics, not recent bestsellers. Judge by the book itself: subjects are hints and often include noise like bestseller lists and library collections.`;

const describe = (book: BookForGenres) =>
  [
    `Title: ${book.title}`,
    `Author: ${book.author}`,
    book.synopsis && `Synopsis: ${book.synopsis}`,
    book.subjects.length > 0 && `Subjects: ${book.subjects.join("; ")}`,
  ]
    .filter(Boolean)
    .join("\n\n");

// Genres for one book, or null when no API key is set. API errors are
// thrown for the caller to log; a refusal just means no genres.
export const pickGenres = async (book: BookForGenres): Promise<Genre[] | null> => {
  if (!anthropic) {
    return null;
  }
  const response = await anthropic.beta.messages.parse(
    {
      model: AI_MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: "user", content: describe(book) }],
      output_config: { effort: "low", format: betaZodOutputFormat(AnswerSchema) },
      // A refused request is retried on another model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    },
    { timeout: 60_000 },
  );
  if (response.stop_reason === "refusal") {
    return [];
  }
  const genres = response.parsed_output?.genres ?? [];
  return [...new Set(genres)].slice(0, MAX_GENRES);
};
