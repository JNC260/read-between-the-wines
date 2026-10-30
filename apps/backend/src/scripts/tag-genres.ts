// Re-tags every book with genres from the club's list, replacing whatever it
// had. Run it once to clean up the free-text genres from the old Google Form,
// and again whenever the genre list changes.
//
//   npx nx run backend:tag-genres --dry-run   # print each book's genres, save nothing
//   npx nx run backend:tag-genres
//
// Needs ANTHROPIC_API_KEY. Against production, point DATABASE_URL at the
// Postgres service's public URL (its DATABASE_PUBLIC_URL in Railway):
//
//   railway run --service web -- env DATABASE_URL='<DATABASE_PUBLIC_URL>' \
//     npx nx run backend:tag-genres
import { parseArgs } from "node:util";
import { genresFor, listBooksForTagging, setGenres } from "../books/books.service";
import { fetchWorkDescription } from "../books/open-library";
import { anthropic } from "../lib/ai";
import { prisma } from "../lib/prisma";
import { printDatabaseTarget } from "./database-target";

// A few at a time: quick, without hammering Open Library.
const AT_ONCE = 4;

const { values } = parseArgs({ options: { "dry-run": { type: "boolean" } } });
const dryRun = values["dry-run"] ?? false;

if (!anthropic) {
  console.error("ANTHROPIC_API_KEY isn't set, so there's nothing to tag with.");
  process.exit(1);
}

printDatabaseTarget();
console.log(dryRun ? "Dry run: nothing will be saved.\n" : "");

// Open Library's subjects help, but a book can be tagged without them.
const subjectsOf = async (workId: string | null) => {
  if (!workId) {
    return [];
  }
  try {
    return (await fetchWorkDescription(workId)).subjects;
  } catch {
    return [];
  }
};

const books = await listBooksForTagging();
let failed = 0;
for (let i = 0; i < books.length; i += AT_ONCE) {
  await Promise.all(
    books.slice(i, i + AT_ONCE).map(async (book) => {
      try {
        const genres =
          (await genresFor(book.id, await subjectsOf(book.openLibraryWorkId))) ?? [];
        if (!dryRun) {
          await setGenres(book.id, genres);
        }
        const was = book.genres.length > 0 ? `  (was: ${book.genres.join(", ")})` : "";
        console.log(`${book.title}: ${genres.join(", ") || "(none)"}${was}`);
      } catch (e) {
        failed++;
        console.error(`${book.title}: failed, kept as it was.`, e);
      }
    }),
  );
}

console.log(
  `\n${dryRun ? "Checked" : "Tagged"} ${books.length - failed} of ${books.length} books.`,
);
await prisma.$disconnect();
process.exit(failed > 0 ? 1 : 0);
