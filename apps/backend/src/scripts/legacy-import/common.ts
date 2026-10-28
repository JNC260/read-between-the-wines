// Shared by transform.ts and seed.ts: where the legacy files live, the shape
// of legacy-books.json, and the small parsing helpers both need.
import path from "node:path";
import * as z from "zod";

// Gitignored: the CSVs, people.json and overrides.json hold member names.
export const LEGACY_DIR = path.resolve(
  import.meta.dirname,
  "../../../prisma/seed-data/legacy",
);
export const legacyPath = (name: string): string => path.join(LEGACY_DIR, name);

// The Google Form and every meeting were in the club's local time.
export const CLUB_TIME_ZONE = "America/Chicago";

// ---------------------------------------------------------------------------
// Hand-edited inputs
// ---------------------------------------------------------------------------

// people.json: lowercased raw name from the sheets -> the person it means.
// Several raw names can point at one slug ("kayla" and "kayla redden").
export const PeopleFileSchema = z.record(
  z.string(),
  z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    isMe: z.boolean(),
  }),
);

// An Open Library work ("OL27482W") or edition ("OL7353617M"); transform.ts
// looks up an edition's work.
const OpenLibraryIdSchema = z.string().regex(/^OL\d+[WM]$/);

const OverrideObjectSchema = z
  .object({
    workId: OpenLibraryIdSchema.optional(),
    manual: z.literal(true).optional(),
    title: z.string().min(1).optional(),
    author: z.string().min(1).optional(),
    year: z.int().nullable().optional(),
    genres: z.array(z.string()).optional(),
    synopsis: z.string().min(1).optional(),
    note: z.string().optional(),
  })
  .strict()
  .refine((o) => !(o.workId && o.manual), {
    message: "Use workId or manual, not both",
  });

// overrides.json. Keys are a row key ("suggestions:12", "read:2024-05") or a
// slug of the sheet's title ("great-alone"), which covers every row with
// that title on either sheet. Values:
//   true                  the automatic match is right
//   "OL...W" / "OL...M"   use this work (or this edition's work)
//   { workId, year, ... } any of the fields below; they win over Open Library
// Field fixes are applied before the lookup, so a corrected title or author
// also improves the search. Strict so a typo'd field name fails loudly.
export const OverridesFileSchema = z.record(
  z.string().min(1),
  z.union([
    z.literal(true).transform(() => ({ accept: true as const })),
    OpenLibraryIdSchema.transform((workId) => ({ workId })),
    OverrideObjectSchema,
  ]),
);

export type Override = z.infer<typeof OverrideObjectSchema> & {
  accept?: true;
};

// ---------------------------------------------------------------------------
// legacy-books.json: written by transform.ts, read by seed.ts
// ---------------------------------------------------------------------------

export type MatchMethod =
  | "override"
  | "manual"
  | "goodreads_id"
  | "title_hint"
  | "title_author"
  | "unresolved";

export type LegacyPerson = {
  slug: string;
  firstName: string;
  lastName: string;
  name: string;
  // null for me: seed.ts links my rows to the existing admin user
  email: string | null;
  isMe: boolean;
};

export type LegacyBook = {
  // openLibraryWorkId, or "manual:<normalized title>|<author>" without one
  key: string;
  openLibraryWorkId: string | null;
  // the best method among the merged rows
  matchMethod: MatchMethod;
  title: string;
  author: string;
  yearPublished: number | null;
  genres: string[];
  coverUrl: string | null;
  pageCount: number | null;
  synopsis: string | null;
  goodreadsUrl: string | null;
  // earliest suggestion, ISO UTC
  createdAt: string;
  // one per person, earliest kept
  suggestions: { personSlug: string; createdAt: string; rowKey: string }[];
  meeting: { title: string; start: string; end: string; rowKey: string } | null;
  rowKeys: string[];
};

export type LegacyData = {
  generatedAt: string;
  people: LegacyPerson[];
  books: LegacyBook[];
};

export const placeholderEmail = (slug: string): string =>
  `placeholder+${slug}@example.invalid`;

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

// Google Sheets CSV export: comma separated, fields with commas, quotes or
// newlines wrapped in double quotes, and "" for a literal quote. Small enough
// not to need a dependency.
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") {
        i++;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
};

// Records keyed by header, each with its row number as Google Sheets shows
// it (the header is row 1). Blank lines are skipped but still counted, so
// the numbers stay stable as row keys.
export const csvRecords = (
  text: string,
): { rowNumber: number; record: Record<string, string> }[] => {
  const [header, ...rows] = parseCsv(text);
  return rows.flatMap((cells, i) => {
    if (cells.every((c) => c.trim() === "")) {
      return [];
    }
    const record = Object.fromEntries(
      header.map((name, col) => [name.trim(), cells[col] ?? ""]),
    );
    return [{ rowNumber: i + 2, record }];
  });
};

// ---------------------------------------------------------------------------
// Time zones
// ---------------------------------------------------------------------------

export type LocalDateTime = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
};

// How far timeZone's wall clock is ahead of UTC at an instant, in ms.
const offsetAt = (instant: number, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const wallAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return wallAsUtc - Math.floor(instant / 1000) * 1000;
};

// A wall-clock time in timeZone -> the UTC instant. Uses the offset in force
// on that date, so CST (-6) and CDT (-5) both come out right. The second
// pass corrects the guess when the first offset was from the other side of
// a DST change.
export const zonedTimeToUtc = (local: LocalDateTime, timeZone: string): Date => {
  const wallAsUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  const firstGuess = wallAsUtc - offsetAt(wallAsUtc, timeZone);
  return new Date(wallAsUtc - offsetAt(firstGuess, timeZone));
};
