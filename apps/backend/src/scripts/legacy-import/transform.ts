// One-time import of the old Google Form data, step 1 of 2. Reads the legacy
// CSVs, people.json and overrides.json, looks every book up on Open Library,
// and writes legacy-books.json (for seed.ts) and review.md (for a human).
//
//   npx nx run backend:legacy-transform
//
// Touches no database. Every Open Library response is cached in
// legacy/.cache/, so reruns after editing overrides.json are fast.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { normalizeTitle, parseGoodreadsUrl } from "shared";
import * as z from "zod";
import {
  coverUrlFor,
  fetchWorkDescription,
  formatAuthors,
  OPEN_LIBRARY_URL,
  type SearchDoc,
  searchOpenLibrary,
  synopsisFrom,
  USER_AGENT,
  workIdFromKey,
} from "../../books/open-library";
import {
  CLUB_TIME_ZONE,
  csvRecords,
  type LegacyBook,
  type LegacyData,
  type LegacyPerson,
  legacyPath,
  type LocalDateTime,
  type MatchMethod,
  type Override,
  OverridesFileSchema,
  PeopleFileSchema,
  placeholderEmail,
  zonedTimeToUtc,
} from "./common";

// Meetings ran 6-9 pm club time.
const MEETING_START_HOUR = 18;
const MEETING_END_HOUR = 21;

// Open Library asks for no more than about one request a second.
const REQUEST_GAP_MS = 1000;
const RETRY_DELAYS_MS = [5000, 15000];

// Best first: a merged book reports the best method among its rows.
const METHOD_RANK: MatchMethod[] = [
  "override",
  "manual",
  "goodreads_id",
  "title_hint",
  "title_author",
  "unresolved",
];

type Candidate = {
  workId: string;
  title: string;
  author: string;
  year: number | null;
};

// One row from either sheet, cleaned, with overrides applied.
type SheetRow = {
  rowKey: string;
  source: "suggestions" | "read";
  personSlugs: string[];
  rawNames: string;
  title: string;
  author: string;
  year: number | null;
  genres: string[];
  link: string | null;
  sheetSynopsis: string | null;
  createdAt: Date;
  meetingDate: { year: number; month: number; day: number } | null;
  override: Override | null;
  // as typed in the sheet, for review.md
  sheet: { title: string; author: string; year: string; link: string };
  warnings: string[];
};

type ResolvedRow = SheetRow & {
  method: MatchMethod;
  doc: SearchDoc | null;
  candidates: Candidate[];
  goodreadsId: string | null;
  // a goodreads_id match whose title or author disagrees with the sheet
  sheetMismatch: boolean;
  synopsis: string | null;
};

// ---------------------------------------------------------------------------
// Cleaning
// ---------------------------------------------------------------------------

const clean = (value: string | undefined): string =>
  (value ?? "")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

// Plain 4-digit years pass through. Anything else ("Releases 7/15/25") gets
// a best guess and a warning.
const parseYear = (raw: string, warnings: string[]): number | null => {
  const value = clean(raw);
  if (!value) {
    return null;
  }
  if (/^\d{4}$/.test(value)) {
    return Number(value);
  }
  const fourDigit = value.match(/\b(1\d{3}|20\d{2})\b/);
  const slashDate = value.match(/\b\d{1,2}\/\d{1,2}\/(\d{2})\b/);
  let guess: number | null = null;
  if (fourDigit) {
    guess = Number(fourDigit[1]);
  } else if (slashDate) {
    guess = 2000 + Number(slashDate[1]);
  }
  warnings.push(
    `Year "${value}" isn't a plain year; guessed ${guess ?? "nothing"}`,
  );
  return guess;
};

const parseGenres = (raw: string): string[] =>
  raw
    .split(",")
    .map(clean)
    .filter((g) => g !== "");

// "M/D/YYYY" or "M/D/YYYY H:MM:SS"
const parseSheetDate = (raw: string, rowKey: string): LocalDateTime => {
  const match = clean(raw).match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{1,2}):(\d{2}):(\d{2}))?$/,
  );
  if (!match) {
    throw new Error(`${rowKey}: can't read date "${raw}"`);
  }
  const [, month, day, year, hour, minute, second] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour ?? 0),
    minute: Number(minute ?? 0),
    second: Number(second ?? 0),
  };
};

// For loose comparisons only: "T. Kingfisher" -> "t kingfisher"
const simplify = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// True when the sheet author's surname appears among Open Library's authors.
const authorMatches = (sheetAuthor: string, olAuthors: string[]): boolean => {
  const surname = simplify(sheetAuthor)
    .split(" ")
    .filter((w) => w.length > 1)
    .at(-1);
  if (!surname) {
    return true;
  }
  return olAuthors.some((a) => simplify(a).split(" ").includes(surname));
};

const editDistance = (a: string, b: string): number => {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
};

const similarity = (a: string, b: string): number =>
  1 - editDistance(a, b) / Math.max(a.length, b.length, 1);

// Main title only, no leading article: "The Nightingale: A Novel" ->
// "nightingale"
const coreTitle = (title: string): string =>
  simplify(title.split(":")[0]).replace(/^(the|an|a) /, "");

// Loose enough for "Traveling" vs "Travelling" and a missing "The", strict
// enough that a different book by the same author doesn't pass.
const titleMatches = (sheetTitle: string, olTitle: string): boolean => {
  const a = coreTitle(sheetTitle);
  const b = coreTitle(olTitle);
  // A title in another script simplifies to "", which shouldn't pass.
  if (!a || !b || a === b) {
    return a === b;
  }
  if (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a))) {
    return true;
  }
  return similarity(a, b) >= 0.8;
};

const sameBook = (row: SheetRow, doc: SearchDoc): boolean =>
  authorMatches(row.author, doc.author_name ?? []) &&
  titleMatches(row.title, doc.title);

// ---------------------------------------------------------------------------
// Reading the sheets
// ---------------------------------------------------------------------------

const readText = (name: string): string =>
  fs.readFileSync(legacyPath(name), "utf8");

const readJson = (name: string, fallback: unknown): unknown =>
  fs.existsSync(legacyPath(name)) ? JSON.parse(readText(name)) : fallback;

const people = PeopleFileSchema.parse(readJson("people.json", {}));
const overrides: Record<string, Override> = OverridesFileSchema.parse(
  readJson("overrides.json", {}),
);

const unknownNames = new Set<string>();

// "Kayla Redden/Jennifer Byers" -> one slug per person
const slugsFor = (cell: string): string[] => {
  const slugs = cell
    .split("/")
    .map((n) => clean(n).toLowerCase())
    .filter((n) => n !== "")
    .flatMap((n) => {
      const person = people[n];
      if (!person) {
        unknownNames.add(n);
        return [];
      }
      return [person.slug];
    });
  return [...new Set(slugs)];
};

const ROW_KEY = /^(suggestions:\d+|read:\d{4}-\d{2})$/;

// "The Last Housewife" -> "last-housewife", "Appeal: A Novel" -> "appeal".
// Articles, subtitles and series notes are dropped from keys and sheet
// titles alike, so either way of writing a key matches.
const titleSlug = (title: string): string =>
  clean(title)
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .split(":")[0]
    .replace(/&/g, " and ")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^(the|an|a)-/, "");

type KeyMatch = { key: string; rowKeys: string[]; fuzzy: boolean };

// Which rows each overrides.json key covers. A title slug with no exact
// match falls back to the one title that's a near miss ("nightengale" ->
// "Nightingale"); fuzzy matches are listed in review.md.
const matchOverrideKeys = (rows: SheetRow[]): KeyMatch[] =>
  Object.keys(overrides).map((key) => {
    if (ROW_KEY.test(key)) {
      const found = rows.some((r) => r.rowKey === key);
      return { key, rowKeys: found ? [key] : [], fuzzy: false };
    }
    const slug = titleSlug(key.replace(/-/g, " "));
    const rowsWithSlug = (target: string) =>
      rows.filter((r) => titleSlug(r.sheet.title) === target).map((r) => r.rowKey);

    const exact = rowsWithSlug(slug);
    if (exact.length > 0) {
      return { key, rowKeys: exact, fuzzy: false };
    }
    const [best, runnerUp] = [...new Set(rows.map((r) => titleSlug(r.sheet.title)))]
      .map((candidate) => ({ candidate, score: similarity(candidate, slug) }))
      .sort((a, b) => b.score - a.score);
    if (best && best.score >= 0.8 && (!runnerUp || runnerUp.score < best.score)) {
      return { key, rowKeys: rowsWithSlug(best.candidate), fuzzy: true };
    }
    return { key, rowKeys: [], fuzzy: false };
  });

const applyOverrides = (rows: SheetRow[], matches: KeyMatch[]): SheetRow[] =>
  rows.map((row) => {
    // A row key is more specific than a title slug, so it goes last and wins.
    const keys = matches
      .filter((m) => m.rowKeys.includes(row.rowKey))
      .map((m) => m.key)
      .sort((a, b) => Number(ROW_KEY.test(a)) - Number(ROW_KEY.test(b)));
    if (keys.length === 0) {
      return row;
    }
    const workIds = new Set(keys.flatMap((k) => overrides[k].workId ?? []));
    if (workIds.size > 1) {
      throw new Error(
        `${row.rowKey} is covered by overrides with different work ids: ${keys.join(", ")}`,
      );
    }
    const override: Override = Object.assign({}, ...keys.map((k) => overrides[k]));
    return {
      ...row,
      override,
      title: override.title ? clean(override.title) : row.title,
      author: override.author ? clean(override.author) : row.author,
      year: override.year !== undefined ? override.year : row.year,
      genres: override.genres ? override.genres.map(clean) : row.genres,
    };
  });

const readSuggestionRows = (): SheetRow[] =>
  csvRecords(readText("suggestions.csv")).map(({ rowNumber, record }) => {
    const rowKey = `suggestions:${rowNumber}`;
    const warnings: string[] = [];
    const synopsisCell = clean(record["Synopsis"]);
    const isLink =
      /^https?:\/\//i.test(synopsisCell) || /goodreads\.com/i.test(synopsisCell);
    return {
      rowKey,
      source: "suggestions",
      personSlugs: slugsFor(record["Your name"]),
      rawNames: clean(record["Your name"]),
      title: clean(record["Book Title"]),
      author: clean(record["Author"]),
      year: parseYear(record["Year published"], warnings),
      genres: parseGenres(record["Genre"]),
      link: isLink ? synopsisCell : null,
      sheetSynopsis: !isLink && synopsisCell ? synopsisCell : null,
      createdAt: zonedTimeToUtc(
        parseSheetDate(record["Timestamp"], rowKey),
        CLUB_TIME_ZONE,
      ),
      meetingDate: null,
      override: null,
      sheet: {
        title: record["Book Title"],
        author: record["Author"],
        year: record["Year published"],
        link: record["Synopsis"],
      },
      warnings,
    };
  });

const readReadRows = (): SheetRow[] => {
  const seenKeys = new Set<string>();
  return csvRecords(readText("read.csv")).map(({ rowNumber, record }) => {
    const date = parseSheetDate(record["Meeting Date"], `read row ${rowNumber}`);
    const rowKey = `read:${date.year}-${String(date.month).padStart(2, "0")}`;
    if (seenKeys.has(rowKey)) {
      throw new Error(
        `read.csv row ${rowNumber}: a second meeting in the same month (${rowKey}); row keys need to be unique`,
      );
    }
    seenKeys.add(rowKey);
    const warnings: string[] = [];
    return {
      rowKey,
      source: "read",
      personSlugs: slugsFor(record["Suggested By"]),
      rawNames: clean(record["Suggested By"]),
      title: clean(record["Book Title"]),
      author: clean(record["Author"]),
      year: parseYear(record["Year Published"], warnings),
      genres: [],
      link: null,
      sheetSynopsis: null,
      // a book on the Read tab counts as suggested at its meeting
      createdAt: zonedTimeToUtc(
        { ...date, hour: MEETING_START_HOUR, minute: 0, second: 0 },
        CLUB_TIME_ZONE,
      ),
      meetingDate: { year: date.year, month: date.month, day: date.day },
      override: null,
      sheet: {
        title: record["Book Title"],
        author: record["Author"],
        year: record["Year Published"],
        link: "",
      },
      warnings,
    };
  });
};

// ---------------------------------------------------------------------------
// Open Library, politely
// ---------------------------------------------------------------------------

const CACHE_DIR = legacyPath(".cache");
fs.mkdirSync(CACHE_DIR, { recursive: true });

let lastRequestAt = 0;
let networkRequests = 0;

// Caches the parsed response under a hash of the request. Failures aren't
// cached, so a rerun tries them again.
const cached = async <T>(key: string, load: () => Promise<T>): Promise<T> => {
  const file = path.join(
    CACHE_DIR,
    `${createHash("sha1").update(key).digest("hex")}.json`,
  );
  if (fs.existsSync(file)) {
    return (JSON.parse(fs.readFileSync(file, "utf8")) as { value: T }).value;
  }

  for (let attempt = 0; ; attempt++) {
    const wait = lastRequestAt + REQUEST_GAP_MS - Date.now();
    if (wait > 0) {
      await sleep(wait);
    }
    try {
      networkRequests++;
      const value = await load();
      lastRequestAt = Date.now();
      fs.writeFileSync(file, JSON.stringify({ key, value }, null, 2));
      return value;
    } catch (e) {
      lastRequestAt = Date.now();
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined) {
        throw e;
      }
      console.warn(`  ${key} failed, retrying in ${delay / 1000}s`);
      await sleep(delay);
    }
  }
};

const search = (query: string, limit = 5): Promise<SearchDoc[]> =>
  cached(`search ${limit} ${query}`, () => searchOpenLibrary(query, limit));

const describe = (workId: string): Promise<string | null> =>
  cached(`work ${workId}`, async () =>
    synopsisFrom(await fetchWorkDescription(workId)),
  );

const EditionSchema = z.object({
  works: z.array(z.object({ key: z.string() })).min(1),
});

// overrides.json can name an edition ("OL7353617M"); books hang off works.
const workIdFor = (id: string): Promise<string> => {
  if (id.endsWith("W")) {
    return Promise.resolve(id);
  }
  return cached(`edition ${id}`, async () => {
    const response = await fetch(`${OPEN_LIBRARY_URL}/books/${id}.json`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      throw new Error(`edition ${id}: HTTP ${response.status}`);
    }
    return workIdFromKey(EditionSchema.parse(await response.json()).works[0].key);
  });
};

// Quotes would end a fielded query early.
const quoted = (value: string): string => `"${value.replace(/"/g, "")}"`;

const toCandidate = (doc: SearchDoc): Candidate => ({
  workId: workIdFromKey(doc.key),
  title: doc.title,
  author: formatAuthors(doc.author_name ?? []),
  year: doc.first_publish_year ?? null,
});

const resolve = async (row: SheetRow): Promise<ResolvedRow> => {
  const parsed = row.link ? parseGoodreadsUrl(row.link) : null;
  if (row.link && !parsed) {
    row.warnings.push(`Synopsis link isn't a Goodreads book link: ${row.link}`);
  }
  const goodreadsId = parsed?.goodreadsId ?? null;
  const base = { ...row, goodreadsId, candidates: [] as Candidate[] };

  const finish = async (
    method: MatchMethod,
    doc: SearchDoc | null,
    candidates: Candidate[] = [],
  ): Promise<ResolvedRow> => {
    let synopsis: string | null = null;
    if (doc) {
      try {
        synopsis = await describe(workIdFromKey(doc.key));
      } catch {
        row.warnings.push(
          `Couldn't fetch the Open Library description for ${workIdFromKey(doc.key)}`,
        );
      }
    }
    if (row.override?.accept && method === "unresolved") {
      row.warnings.push("Marked true in overrides.json, but nothing matched");
    }
    if (!synopsis && row.sheetSynopsis) {
      synopsis = row.sheetSynopsis;
      row.warnings.push(
        `Synopsis taken from the sheet text: "${row.sheetSynopsis}"`,
      );
    }
    return {
      ...base,
      warnings: row.warnings,
      method,
      doc,
      candidates,
      synopsis,
      sheetMismatch:
        doc !== null && row.override?.workId === undefined && !sameBook(row, doc),
    };
  };

  if (row.override?.manual) {
    return finish("manual", null);
  }

  if (row.override?.workId) {
    const workId = await workIdFor(row.override.workId);
    const docs = await search(`key:"/works/${workId}"`, 1);
    if (docs.length === 0) {
      throw new Error(
        `${row.rowKey}: override ${row.override.workId} (work ${workId}) isn't in Open Library search`,
      );
    }
    const doc = docs[0];
    // A link that Open Library ties to some other work is for a different
    // book (Run Baby Run's links to the 1968 one), so don't store it.
    if (goodreadsId) {
      const linked = await search(`id_goodreads:${goodreadsId}`);
      if (linked.length > 0 && !linked.some((d) => d.key === doc.key)) {
        row.warnings.push(
          `The sheet's Goodreads link is for "${linked[0].title}" by ${formatAuthors(linked[0].author_name ?? [])}, not the override's work; not stored`,
        );
        base.goodreadsId = null;
      }
    }
    if (!row.override.title && !titleMatches(row.title, doc.title)) {
      row.warnings.push(
        `Open Library's title is "${doc.title}"; add a title to the override to use another`,
      );
    }
    return finish("override", doc);
  }

  if (goodreadsId) {
    const docs = await search(`id_goodreads:${goodreadsId}`);
    if (docs.length > 0) {
      return finish("goodreads_id", docs[0]);
    }
  }

  // Title searches return near misses (another book by the same author, a
  // study guide), so a result only counts when both title and author agree
  // with the sheet. Otherwise the row stays unresolved, with the candidates
  // listed for review.
  if (parsed?.titleHint) {
    const docs = await search(`title:${quoted(parsed.titleHint)}`);
    const match = docs.find((d) => sameBook(row, d));
    if (match) {
      return finish("title_hint", match, docs.slice(0, 3).map(toCandidate));
    }
  }

  let docs = await search(
    `title:${quoted(row.title)} author:${quoted(row.author)}`,
  );
  // Open Library's title search is thrown by a leading article or a series
  // note: "The Last Housewife" finds nothing where "Last Housewife" works.
  const bareTitle = row.title
    .replace(/\([^)]*\)/g, "")
    .replace(/^(the|an|a) /i, "")
    .trim();
  if (docs.length === 0 && bareTitle && bareTitle !== row.title) {
    docs = await search(
      `title:${quoted(bareTitle)} author:${quoted(row.author)}`,
    );
  }
  if (docs.length === 0) {
    // Typos in either field sink the fielded search; free text is looser.
    docs = await search(`${row.title} ${row.author}`);
  }
  const match = docs.find((d) => sameBook(row, d));
  if (match) {
    return finish("title_author", match, docs.slice(0, 3).map(toCandidate));
  }

  return finish("unresolved", null, docs.slice(0, 3).map(toCandidate));
};

// ---------------------------------------------------------------------------
// Merging rows into books
// ---------------------------------------------------------------------------

const manualKey = (title: string, author: string): string =>
  `manual:${normalizeTitle(title)}|${simplify(author)}`;

const bookKey = (row: ResolvedRow): string =>
  row.doc ? workIdFromKey(row.doc.key) : manualKey(row.title, row.author);

const monthName = (month: number): string =>
  new Date(Date.UTC(2000, month - 1, 1)).toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });

type MergeNote = { key: string; title: string; rows: ResolvedRow[]; notes: string[] };

const buildBook = (
  key: string,
  rows: ResolvedRow[],
  mergeNotes: MergeNote[],
): LegacyBook => {
  const byDate = [...rows].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const first = byDate[0];
  const doc = byDate.find((r) => r.doc)?.doc ?? null;
  const override = byDate.find((r) => r.override)?.override ?? null;
  const notes: string[] = [];

  // Overrides win, then Open Library, then the sheet.
  const title = override?.title ?? doc?.title ?? first.title;
  const author =
    override?.author ??
    (doc ? formatAuthors(doc.author_name ?? []) : first.author);
  // The sheets' years win (overrides are already applied to them). Open
  // Library's first_publish_year is often an early edition or plain wrong:
  // Americanah as 1969.
  const yearPublished =
    byDate.find((r) => r.year !== null)?.year ?? doc?.first_publish_year ?? null;

  // Keep each genre as first written; drop repeats that differ only in case.
  const genres: string[] = [];
  for (const g of byDate.flatMap((r) => r.genres)) {
    if (!genres.some((kept) => kept.toLowerCase() === g.toLowerCase())) {
      genres.push(g);
    }
  }

  const goodreadsIds = [
    ...new Set(byDate.flatMap((r) => (r.goodreadsId ? [r.goodreadsId] : []))),
  ];
  if (goodreadsIds.length > 1) {
    notes.push(
      `Different Goodreads ids (${goodreadsIds.join(", ")}); kept ${goodreadsIds[0]}`,
    );
  }

  const suggestions = new Map<
    string,
    { personSlug: string; createdAt: string; rowKey: string }
  >();
  for (const row of byDate) {
    for (const slug of row.personSlugs) {
      const kept = suggestions.get(slug);
      if (kept) {
        notes.push(
          `${slug} suggested it again in ${row.rowKey}; kept the earlier ${kept.rowKey}`,
        );
      } else {
        suggestions.set(slug, {
          personSlug: slug,
          createdAt: row.createdAt.toISOString(),
          rowKey: row.rowKey,
        });
      }
    }
  }

  const readRows = byDate.filter((r) => r.meetingDate);
  if (readRows.length > 1) {
    notes.push(
      `On the Read tab more than once (${readRows.map((r) => r.rowKey).join(", ")}); a book can only have one meeting, so only ${readRows[0].rowKey} is kept`,
    );
  }
  let meeting: LegacyBook["meeting"] = null;
  if (readRows[0]?.meetingDate) {
    const date = readRows[0].meetingDate;
    const at = (hour: number) =>
      zonedTimeToUtc({ ...date, hour, minute: 0, second: 0 }, CLUB_TIME_ZONE)
        .toISOString();
    meeting = {
      title: `${monthName(date.month)} Meeting - ${title}`,
      start: at(MEETING_START_HOUR),
      end: at(MEETING_END_HOUR),
      rowKey: readRows[0].rowKey,
    };
  }

  if (rows.length > 1 || notes.length > 0) {
    mergeNotes.push({ key, title, rows: byDate, notes });
  }

  const best = METHOD_RANK.find((m) => rows.some((r) => r.method === m));

  return {
    key,
    openLibraryWorkId: doc ? workIdFromKey(doc.key) : null,
    matchMethod: best ?? "unresolved",
    title,
    author,
    yearPublished,
    genres,
    coverUrl: doc ? coverUrlFor(doc.cover_i) : null,
    pageCount: doc?.number_of_pages_median ?? null,
    synopsis:
      override?.synopsis ?? byDate.find((r) => r.synopsis)?.synopsis ?? null,
    goodreadsUrl: goodreadsIds[0]
      ? `https://www.goodreads.com/book/show/${goodreadsIds[0]}`
      : null,
    createdAt: first.createdAt.toISOString(),
    suggestions: [...suggestions.values()],
    meeting,
    rowKeys: byDate.map((r) => r.rowKey),
  };
};

// ---------------------------------------------------------------------------
// review.md
// ---------------------------------------------------------------------------

const workLink = (workId: string) =>
  `[${workId}](https://openlibrary.org/works/${workId})`;

const sheetLine = (row: ResolvedRow): string => {
  const parts = [
    `"${clean(row.sheet.title)}"`,
    `by ${clean(row.sheet.author) || "(no author)"}`,
    clean(row.sheet.year) || "(no year)",
  ];
  if (clean(row.sheet.link)) {
    parts.push(`<${clean(row.sheet.link)}>`);
  }
  return `  - Sheet: ${parts.join(", ")} (${row.rawNames})`;
};

const matchLine = (row: ResolvedRow): string => {
  if (!row.doc) {
    return "  - Match: none";
  }
  const c = toCandidate(row.doc);
  return `  - Match: "${c.title}" by ${c.author}, ${c.year ?? "(no year)"}, ${workLink(c.workId)}`;
};

const candidateLines = (row: ResolvedRow): string[] =>
  row.candidates.length === 0
    ? []
    : [
        "  - Candidates:",
        ...row.candidates.map(
          (c) =>
            `    - "${c.title}" by ${c.author}, ${c.year ?? "(no year)"}, ${workLink(c.workId)}`,
        ),
      ];

const rowEntry = (row: ResolvedRow, extra: string[] = []): string[] => [
  `- \`${row.rowKey}\``,
  sheetLine(row),
  matchLine(row),
  ...extra,
];

const buildReview = (
  rows: ResolvedRow[],
  books: LegacyBook[],
  mergeNotes: MergeNote[],
  keyMatches: KeyMatch[],
): string => {
  const sections: { heading: string; intro: string; lines: string[] }[] = [];
  const add = (heading: string, intro: string, lines: string[]) => {
    if (lines.length > 0) {
      sections.push({ heading, intro, lines });
    }
  };

  add(
    "Unresolved",
    "No Open Library result agreed with the sheet's title and author. These import as manual books unless overrides.json gives a workId; the candidates are what the search did return.",
    rows
      .filter((r) => r.method === "unresolved")
      .flatMap((r) => rowEntry(r, candidateLines(r))),
  );

  add(
    "Matched without a Goodreads id",
    "Matched by the link's title words (title_hint) or the sheet's title and author (title_author). Check the match is the right book.",
    rows
      .filter(
        (r) =>
          !r.override &&
          (r.method === "title_hint" || r.method === "title_author"),
      )
      .flatMap((r) => rowEntry(r, [`  - Method: ${r.method}`, ...candidateLines(r)])),
  );

  add(
    "Goodreads match disagrees with the sheet",
    "The Goodreads id led to a work whose title or author doesn't match what was typed. Either the link in the sheet is for a different book, or Open Library has the work under another language's title.",
    rows
      .filter((r) => r.sheetMismatch && !r.override)
      .flatMap((r) => rowEntry(r)),
  );

  const titleGroups = new Map<string, LegacyBook[]>();
  for (const book of books) {
    const t = normalizeTitle(book.title);
    titleGroups.set(t, [...(titleGroups.get(t) ?? []), book]);
  }
  add(
    "Possible duplicates",
    "Same title, but they didn't merge (different works, or one is unresolved). Point them at one workId in overrides.json if they're the same book.",
    [...titleGroups.values()]
      .filter((group) => group.length > 1)
      .flatMap((group) => [
        `- "${group[0].title}"`,
        ...group.map(
          (b) =>
            `  - ${b.openLibraryWorkId ? workLink(b.openLibraryWorkId) : "manual"} by ${b.author}: ${b.rowKeys.map((k) => `\`${k}\``).join(", ")}`,
        ),
      ]),
  );

  add(
    "Merges",
    "Rows that became one book.",
    mergeNotes.flatMap((m) => [
      `- "${m.title}" (${m.key.startsWith("manual:") ? "manual" : workLink(m.key)})`,
      ...m.rows.map(
        (r) =>
          `  - \`${r.rowKey}\` ${r.rawNames}, ${r.createdAt.toISOString().slice(0, 10)}: "${r.title}" by ${r.author} (${r.method})`,
      ),
      ...m.notes.map((n) => `  - **${n}**`),
    ]),
  );

  add(
    "Field warnings",
    "Values that were guessed or came from somewhere unusual.",
    rows
      .filter((r) => r.warnings.length > 0)
      .flatMap((r) => [
        `- \`${r.rowKey}\` "${r.title}"`,
        ...r.warnings.map((w) => `  - ${w}`),
      ]),
  );

  add(
    "Missing synopsis",
    "Open Library has no description and the sheet had no text. To add one, give the key a synopsis in overrides.json; if its value is a plain id, turn it into an object: { \"workId\": \"OL...\", \"synopsis\": \"...\" }.",
    books
      .filter((b) => !b.synopsis)
      .map((b) => {
        const row = rows.find((r) => r.rowKey === b.rowKeys[0]);
        const key = row ? titleSlug(row.sheet.title) : b.rowKeys[0];
        return `- "${b.title}" by ${b.author}: \`${key}\``;
      }),
  );

  const titleOf = (rowKey: string) =>
    rows.find((r) => r.rowKey === rowKey)?.sheet.title.trim() ?? rowKey;
  add(
    "Override keys matched loosely",
    "These slugs didn't match a sheet title exactly, so they went to the closest one. Check each is the book you meant.",
    keyMatches
      .filter((m) => m.fuzzy)
      .map(
        (m) =>
          `- \`${m.key}\` -> "${titleOf(m.rowKeys[0])}" (${m.rowKeys.map((k) => `\`${k}\``).join(", ")})`,
      ),
  );

  add(
    "Unused overrides",
    "Keys in overrides.json that don't match any row, so they did nothing.",
    keyMatches.filter((m) => m.rowKeys.length === 0).map((m) => `- \`${m.key}\``),
  );

  return [
    "# Legacy import review",
    "",
    `Generated ${new Date().toISOString()}. Fix things in overrides.json and rerun; overrides win.`,
    "",
    ...sections.flatMap((s) => [`## ${s.heading}`, "", s.intro, "", ...s.lines, ""]),
  ].join("\n");
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const rawRows = [...readSuggestionRows(), ...readReadRows()];
const keyMatches = matchOverrideKeys(rawRows);
const sheetRows = applyOverrides(rawRows, keyMatches);

if (unknownNames.size > 0) {
  console.error(
    `Names missing from people.json: ${[...unknownNames].sort().join(", ")}`,
  );
  process.exit(1);
}
const nameless = sheetRows.filter((r) => r.personSlugs.length === 0);
if (nameless.length > 0) {
  console.error(
    `Rows with no name: ${nameless.map((r) => r.rowKey).join(", ")}`,
  );
  process.exit(1);
}

console.log(`Resolving ${sheetRows.length} rows against Open Library...`);
const resolved: ResolvedRow[] = [];
for (const row of sheetRows) {
  resolved.push(await resolve(row));
  if (resolved.length % 25 === 0) {
    console.log(`  ${resolved.length}/${sheetRows.length}`);
  }
}

const groups = new Map<string, ResolvedRow[]>();
for (const row of resolved) {
  const key = bookKey(row);
  groups.set(key, [...(groups.get(key) ?? []), row]);
}
const mergeNotes: MergeNote[] = [];
const books = [...groups.entries()].map(([key, rows]) =>
  buildBook(key, rows, mergeNotes),
);

const usedSlugs = new Set(resolved.flatMap((r) => r.personSlugs));
const peopleOut = new Map<string, LegacyPerson>();
for (const p of Object.values(people)) {
  if (usedSlugs.has(p.slug) && !peopleOut.has(p.slug)) {
    peopleOut.set(p.slug, {
      slug: p.slug,
      firstName: p.firstName,
      lastName: p.lastName,
      name: `${p.firstName} ${p.lastName}`,
      email: p.isMe ? null : placeholderEmail(p.slug),
      isMe: p.isMe,
    });
  }
}


const data: LegacyData = {
  generatedAt: new Date().toISOString(),
  people: [...peopleOut.values()],
  books,
};
fs.writeFileSync(legacyPath("legacy-books.json"), `${JSON.stringify(data, null, 2)}\n`);
fs.writeFileSync(
  legacyPath("review.md"),
  buildReview(resolved, books, mergeNotes, keyMatches),
);

const countBy = <T>(items: T[], key: (item: T) => string) =>
  Object.fromEntries(
    METHOD_RANK.map((m) => [m, items.filter((i) => key(i) === m).length]).filter(
      ([, n]) => n !== 0,
    ),
  );

console.log(`\nOpen Library requests this run: ${networkRequests} (rest from cache)`);
console.log(`Rows: ${resolved.length}`, countBy(resolved, (r) => r.method));
console.log(`Books: ${books.length}`, countBy(books, (b) => b.matchMethod));
console.log(
  `People: ${peopleOut.size}, suggestions: ${books.reduce((n, b) => n + b.suggestions.length, 0)}, meetings: ${books.filter((b) => b.meeting).length}`,
);
console.log(
  `Merged books: ${mergeNotes.filter((m) => m.rows.length > 1).length}, Goodreads matches that disagree with the sheet: ${resolved.filter((r) => r.sheetMismatch).length}, rows with warnings: ${resolved.filter((r) => r.warnings.length > 0).length}`,
);
console.log(
  `Overrides: ${resolved.filter((r) => r.override).length} rows covered, ${keyMatches.filter((m) => m.fuzzy).length} keys matched loosely, ${keyMatches.filter((m) => m.rowKeys.length === 0).length} unused`,
);
console.log("Wrote legacy-books.json and review.md");
