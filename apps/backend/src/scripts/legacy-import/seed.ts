// One-time import of the old Google Form data, step 2 of 2. Writes
// legacy-books.json (from transform.ts) into the database.
//
//   npx nx run backend:legacy-seed --dry-run    counts only; nothing is kept
//   npx nx run backend:legacy-seed
//
// Against production, use the live service's variables with DATABASE_URL
// set to the Postgres service's DATABASE_PUBLIC_URL, and run create-admin
// first: my rows link to the existing admin.
//
//   railway run --service web -- env DATABASE_URL='<DATABASE_PUBLIC_URL>' \
//     npx nx run backend:legacy-seed --dry-run
//
// Safe to rerun. Every row is found by a natural key (email, work id,
// user + book, book) and only fields that differ are written, so a second
// run reports nothing created or updated. It all happens in one
// transaction: a failure part way leaves the database as it was.
import fs from "node:fs";
import { parseArgs } from "node:util";
import { normalizeTitle } from "shared";
import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { printDatabaseTarget } from "../database-target";
import { type LegacyBook, type LegacyData, legacyPath } from "./common";

const { values } = parseArgs({
  options: { "dry-run": { type: "boolean", default: false } },
});
const dryRun = values["dry-run"] ?? false;

const data = JSON.parse(
  fs.readFileSync(legacyPath("legacy-books.json"), "utf8"),
) as LegacyData;

printDatabaseTarget();
console.log(
  dryRun
    ? "Dry run: writes happen inside the transaction, which is then rolled back"
    : "Writing for real",
);

type Tx = Prisma.TransactionClient;
type Model = "User" | "Book" | "Suggestion" | "Meeting";
type Counts = { created: number; updated: number; unchanged: number };

const counts: Record<Model, Counts> = {
  User: { created: 0, updated: 0, unchanged: 0 },
  Book: { created: 0, updated: 0, unchanged: 0 },
  Suggestion: { created: 0, updated: 0, unchanged: 0 },
  Meeting: { created: 0, updated: 0, unchanged: 0 },
};

const sameValue = (a: unknown, b: unknown): boolean => {
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }
  return a === b;
};

// The fields of wanted that differ from existing, so unchanged rows aren't
// written and the counts mean something.
const changes = <T extends object>(existing: object, wanted: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(wanted).filter(
      ([key, value]) =>
        !sameValue((existing as Record<string, unknown>)[key], value),
    ),
  ) as Partial<T>;

const earlier = (a: Date, b: Date): Date => (a < b ? a : b);

const rowCounts = async (tx: Tx) => ({
  User: await tx.user.count(),
  Book: await tx.book.count(),
  Suggestion: await tx.suggestion.count(),
  Meeting: await tx.meeting.count(),
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

// slug -> user id
const seedUsers = async (tx: Tx): Promise<Map<string, string>> => {
  const userIds = new Map<string, string>();

  const admins = await tx.user.findMany({ where: { isAdmin: true } });
  if (admins.length !== 1) {
    throw new Error(
      `Expected exactly one admin to link my rows to, found ${admins.length}`,
    );
  }
  const me = admins[0];

  for (const person of data.people) {
    if (person.isMe || !person.email) {
      console.log(`Linking ${person.slug} to the admin, ${me.name}`);
      userIds.set(person.slug, me.id);
      continue;
    }

    // No Account row: placeholders can't sign in. INACTIVE keeps them off
    // member lists until someone claims the account.
    const wanted = {
      name: person.name,
      firstName: person.firstName,
      lastName: person.lastName,
      status: "INACTIVE" as const,
    };
    const existing = await tx.user.findUnique({
      where: { email: person.email },
    });
    if (!existing) {
      const created = await tx.user.create({
        data: { ...wanted, email: person.email },
      });
      counts.User.created++;
      userIds.set(person.slug, created.id);
      continue;
    }

    const diff = changes(existing, wanted);
    if (Object.keys(diff).length > 0) {
      await tx.user.update({ where: { id: existing.id }, data: diff });
      counts.User.updated++;
    } else {
      counts.User.unchanged++;
    }
    userIds.set(person.slug, existing.id);
  }
  return userIds;
};

// ---------------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------------

const findBook = (tx: Tx, book: LegacyBook) =>
  book.openLibraryWorkId
    ? tx.book.findUnique({
        where: { openLibraryWorkId: book.openLibraryWorkId },
      })
    : tx.book.findFirst({
        where: {
          openLibraryWorkId: null,
          normalizedTitle: normalizeTitle(book.title),
          author: book.author,
        },
      });

// Returns the book's id.
const seedBook = async (tx: Tx, book: LegacyBook): Promise<string> => {
  const legacyCreatedAt = new Date(book.createdAt);
  const existing = await findBook(tx, book);

  if (!existing) {
    const created = await tx.book.create({
      data: {
        title: book.title,
        normalizedTitle: normalizeTitle(book.title),
        author: book.author,
        yearPublished: book.yearPublished,
        genres: book.genres,
        coverUrl: book.coverUrl,
        pageCount: book.pageCount,
        synopsis: book.synopsis,
        openLibraryWorkId: book.openLibraryWorkId,
        goodreadsUrl: book.goodreadsUrl,
        createdAt: legacyCreatedAt,
      },
    });
    counts.Book.created++;
    return created.id;
  }

  // A book already suggested through the app keeps what it has where the
  // legacy data is empty, and keeps any genres it had. Title, author and
  // year come from the reviewed legacy data.
  const genres = [...existing.genres];
  for (const g of book.genres) {
    if (!genres.some((kept) => kept.toLowerCase() === g.toLowerCase())) {
      genres.push(g);
    }
  }
  const wanted = {
    title: book.title,
    normalizedTitle: normalizeTitle(book.title),
    author: book.author,
    yearPublished: book.yearPublished,
    genres,
    coverUrl: book.coverUrl ?? existing.coverUrl,
    pageCount: book.pageCount ?? existing.pageCount,
    synopsis: book.synopsis ?? existing.synopsis,
    goodreadsUrl: book.goodreadsUrl ?? existing.goodreadsUrl,
    createdAt: earlier(existing.createdAt, legacyCreatedAt),
  };
  const diff = changes(existing, wanted);
  if (Object.keys(diff).length > 0) {
    await tx.book.update({ where: { id: existing.id }, data: diff });
    counts.Book.updated++;
  } else {
    counts.Book.unchanged++;
  }
  return existing.id;
};

// ---------------------------------------------------------------------------
// Suggestions and meetings
// ---------------------------------------------------------------------------

const seedSuggestions = async (
  tx: Tx,
  book: LegacyBook,
  bookId: string,
  userIds: Map<string, string>,
) => {
  for (const suggestion of book.suggestions) {
    const userId = userIds.get(suggestion.personSlug);
    if (!userId) {
      throw new Error(`No user for ${suggestion.personSlug}`);
    }
    const legacyCreatedAt = new Date(suggestion.createdAt);
    const existing = await tx.suggestion.findUnique({
      where: { userId_bookId: { userId, bookId } },
    });
    if (!existing) {
      await tx.suggestion.create({
        data: { userId, bookId, createdAt: legacyCreatedAt },
      });
      counts.Suggestion.created++;
    } else if (existing.createdAt > legacyCreatedAt) {
      // Suggested again through the app later: the sheet has the first time.
      await tx.suggestion.update({
        where: { userId_bookId: { userId, bookId } },
        data: { createdAt: legacyCreatedAt },
      });
      counts.Suggestion.updated++;
    } else {
      counts.Suggestion.unchanged++;
    }
  }
};

const seedMeeting = async (tx: Tx, book: LegacyBook, bookId: string) => {
  if (!book.meeting) {
    return;
  }
  const wanted = {
    title: book.meeting.title,
    start: new Date(book.meeting.start),
    end: new Date(book.meeting.end),
  };
  const existing = await tx.meeting.findUnique({ where: { bookId } });
  if (!existing) {
    await tx.meeting.create({ data: { ...wanted, bookId } });
    counts.Meeting.created++;
    return;
  }

  const diff = changes(existing, wanted);
  if (Object.keys(diff).length > 0) {
    // Only an app-made meeting or edited legacy data gets here; say what
    // moved so a real meeting isn't silently rescheduled.
    console.warn(
      `Updating meeting "${existing.title}" (${existing.start.toISOString()}): ${Object.keys(diff).join(", ")}`,
    );
    await tx.meeting.update({ where: { id: existing.id }, data: diff });
    counts.Meeting.updated++;
  } else {
    counts.Meeting.unchanged++;
  }
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

class DryRunRollback extends Error {}

let before: Record<Model, number> | null = null;
let after: Record<Model, number> | null = null;

try {
  await prisma.$transaction(
    async (tx) => {
      before = await rowCounts(tx);
      const userIds = await seedUsers(tx);
      for (const book of data.books) {
        const bookId = await seedBook(tx, book);
        await seedSuggestions(tx, book, bookId, userIds);
        await seedMeeting(tx, book, bookId);
      }
      after = await rowCounts(tx);
      if (dryRun) {
        throw new DryRunRollback();
      }
    },
    { timeout: 120_000 },
  );
} catch (e) {
  if (!(e instanceof DryRunRollback)) {
    throw e;
  }
} finally {
  await prisma.$disconnect();
}

console.table(
  Object.fromEntries(
    (Object.keys(counts) as Model[]).map((model) => [
      model,
      {
        ...counts[model],
        "rows before": before?.[model],
        "rows after": after?.[model],
      },
    ]),
  ),
);
console.log(dryRun ? "Rolled back: nothing was kept" : "Committed");
