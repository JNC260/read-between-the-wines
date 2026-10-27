import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  MAX_POLL_BOOKS,
  MIN_POLL_BOOKS,
  type SuggestedBookDTO,
  type SuggesterDTO,
} from "shared";
import BookCover from "../components/BookCover";
import { useBookSuggestions, useCurrentPoll } from "../hooks";
import { authClient } from "../lib/auth-client";
import { initials } from "../lib/initials";

type SortOrder = "asc" | "desc";

// Each field knows how to compare two books and which way it reads most
// naturally when first picked: newest, most-suggested and longest first,
// titles and authors A to Z.
const SORTS = {
  suggestedAt: {
    label: "Date suggested",
    defaultOrder: "desc",
    value: (b: SuggestedBookDTO) => b.suggestedAt.getTime(),
  },
  title: {
    label: "Title",
    defaultOrder: "asc",
    value: (b: SuggestedBookDTO) => b.title,
  },
  author: {
    label: "Author",
    defaultOrder: "asc",
    value: (b: SuggestedBookDTO) => b.author,
  },
  yearPublished: {
    label: "Year published",
    defaultOrder: "desc",
    value: (b: SuggestedBookDTO) => b.yearPublished,
  },
  pageCount: {
    label: "Length",
    defaultOrder: "desc",
    value: (b: SuggestedBookDTO) => b.pageCount,
  },
  suggesters: {
    label: "Number of suggestions",
    defaultOrder: "desc",
    value: (b: SuggestedBookDTO) => b.suggestedBy.length,
  },
} satisfies Record<
  string,
  {
    label: string;
    defaultOrder: SortOrder;
    value: (b: SuggestedBookDTO) => string | number | null;
  }
>;

type SortField = keyof typeof SORTS;

const isSortField = (s: string | null): s is SortField =>
  s !== null && Object.hasOwn(SORTS, s);

// Unknown books (no year, no page count) go last whichever way you sort.
// Ties keep the newest suggestion first.
const sortBooks = (
  books: SuggestedBookDTO[],
  field: SortField,
  order: SortOrder,
) => {
  const { value } = SORTS[field];
  const direction = order === "asc" ? 1 : -1;
  return [...books].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x !== y) {
      if (x === null) return 1;
      if (y === null) return -1;
      const compared =
        typeof x === "string" && typeof y === "string"
          ? x.localeCompare(y)
          : Number(x) - Number(y);
      if (compared !== 0) return compared * direction;
    }
    return b.suggestedAt.getTime() - a.suggestedAt.getTime();
  });
};

// Page-count buckets for the length filter.
const LENGTHS = {
  short: { label: "Under 300 pages", test: (pages: number) => pages < 300 },
  medium: {
    label: "300 to 450 pages",
    test: (pages: number) => pages >= 300 && pages <= 450,
  },
  long: { label: "Over 450 pages", test: (pages: number) => pages > 450 },
};

type LengthFilter = keyof typeof LENGTHS;

const isLength = (s: string | null): s is LengthFilter =>
  s !== null && Object.hasOwn(LENGTHS, s);

type Filters = {
  q: string;
  length: LengthFilter | null;
  genre: string | null;
  mine: boolean;
};

// A book with no page count only shows when no length is picked.
const filterBooks = (books: SuggestedBookDTO[], f: Filters) => {
  const q = f.q.trim().toLowerCase();
  return books.filter(
    (b) =>
      (!q || `${b.title} ${b.author}`.toLowerCase().includes(q)) &&
      (!f.length ||
        (b.pageCount !== null && LENGTHS[f.length].test(b.pageCount))) &&
      (!f.genre || b.genres.includes(f.genre)) &&
      (!f.mine || b.suggestedByMe),
  );
};

const suggestedOn = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

// "Ada L., Ben O."
const names = (members: SuggesterDTO[]) =>
  members.map((m) => `${m.firstName} ${m.lastName.charAt(0)}.`).join(", ");

const details = (book: SuggestedBookDTO) =>
  [
    book.yearPublished,
    book.pageCount && `${book.pageCount} pages`,
    book.genres.length > 0 && book.genres.join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

const closesOn = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const MAX_FACES = 3;

// Admins get a checkbox per book when they're able to start a poll.
type Selection = {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
};

const SuggestionItem = ({
  book,
  onBallot,
  selection,
}: {
  book: SuggestedBookDTO;
  onBallot: boolean;
  selection?: Selection;
}) => (
  <li
    className={`catalog-card${selection?.checked ? " catalog-card-picked" : ""}`}
  >
    <BookCover book={book} />
    <div className="catalog-card-text">
      <h2>{book.title}</h2>
      <p className="byline">{book.author}</p>
      {details(book) && <p className="catalog-card-meta">{details(book)}</p>}
      <div className="catalog-card-foot">
        <span className="faces" aria-hidden="true">
          {book.suggestedBy.slice(0, MAX_FACES).map((m) => (
            <span key={m.id} className="face">
              {initials(m)}
            </span>
          ))}
        </span>
        <span>
          Suggested by {names(book.suggestedBy)} on{" "}
          <time dateTime={book.suggestedAt.toISOString()}>
            {suggestedOn.format(book.suggestedAt)}
          </time>
        </span>
      </div>
      {(onBallot || book.suggestedByMe) && (
        <p className="badges">
          {onBallot && <span className="badge badge-ballot">On the ballot</span>}
          {book.suggestedByMe && (
            <span className="badge badge-mine">You suggested this</span>
          )}
        </p>
      )}
    </div>
    {selection && (
      <input
        type="checkbox"
        className="catalog-card-check"
        aria-label={`Select ${book.title} for a poll`}
        checked={selection.checked}
        disabled={selection.disabled}
        onChange={selection.onChange}
      />
    )}
  </li>
);

// A toggle chip: tap to turn the filter on, tap again to turn it off.
const Chip = ({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) => (
  <button
    type="button"
    className="chip"
    aria-pressed={pressed}
    onClick={onClick}
  >
    {children}
  </button>
);

const SuggestionsPage = () => {
  const { data: books, isPending, error } = useBookSuggestions();
  const { data: session } = authClient.useSession();
  const { data: currentPoll } = useCurrentPoll();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  // Ids in the order they were picked. Not kept in the URL like the sort,
  // since a poll is created straight after picking.
  const [selected, setSelected] = useState<string[]>([]);

  const ballot = new Set(currentPoll?.books.map((b) => b.id));
  // Only one poll can be open, so there's nothing to select until it closes.
  const canStartPoll = !!session?.user.isAdmin && currentPoll === null;
  const full = selected.length >= MAX_POLL_BOOKS;

  const toggle = (id: string) =>
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id],
    );

  const selectionFor = (id: string): Selection | undefined => {
    if (!canStartPoll) {
      return undefined;
    }
    const checked = selected.includes(id);
    return { checked, disabled: full && !checked, onChange: () => toggle(id) };
  };

  const sortParam = searchParams.get("sort");
  const field: SortField = isSortField(sortParam) ? sortParam : "suggestedAt";
  const orderParam = searchParams.get("order");
  const order: SortOrder =
    orderParam === "asc" || orderParam === "desc"
      ? orderParam
      : SORTS[field].defaultOrder;

  const lengthParam = searchParams.get("length");
  const filters: Filters = {
    q: searchParams.get("q") ?? "",
    length: isLength(lengthParam) ? lengthParam : null,
    genre: searchParams.get("genre"),
    mine: searchParams.get("mine") === "1",
  };

  // Sort and filters live in the URL, so a shared link opens the same view.
  // replace, so each change doesn't pile up history entries.
  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    setSearchParams(next, { replace: true });
  };
  const setSort = (nextField: SortField, nextOrder: SortOrder) =>
    update({ sort: nextField, order: nextOrder });
  const clearFilters = () =>
    update({ q: null, length: null, genre: null, mine: null });

  // Genres only show once some book has them.
  const genres = [...new Set(books?.flatMap((b) => b.genres))].sort();
  const shown = books && sortBooks(filterBooks(books, filters), field, order);

  return (
    <div className="suggestions-page">
      <div className="page-head">
        <div>
          <h1>Suggested books</h1>
          {books && books.length > 0 && shown && (
            <p className="muted" aria-live="polite">
              {shown.length === books.length
                ? `${books.length} ${books.length === 1 ? "book" : "books"}`
                : `${shown.length} of ${books.length} books`}
            </p>
          )}
        </div>
        <Link to="/books/suggest" className="button-link button-quiet">
          Suggest a book
        </Link>
      </div>

      {session?.user.isAdmin && currentPoll && (
        <p className="notice">
          <Link to={`/polls/${currentPoll.id}`}>A poll is open</Link> until{" "}
          {closesOn.format(currentPoll.closesAt)}. You can start the next one
          once it closes.
        </p>
      )}

      {isPending && <p>Loading...</p>}
      {error && <p role="alert">{error.message}</p>}
      {books?.length === 0 && (
        <p>No suggestions yet. Be the first to suggest a book.</p>
      )}

      {books && books.length > 0 && shown && (
        <div className="catalog">
          <div className="catalog-filters">
            <label className="search">
              <span className="visually-hidden">Search titles and authors</span>
              <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M20 20l-4.2-4.2" />
              </svg>
              <input
                id="suggestion-search"
                type="search"
                placeholder="Title or author"
                value={filters.q}
                onChange={(e) => update({ q: e.target.value })}
              />
            </label>

            <div className="filter-groups">
              <div role="group" aria-labelledby="filter-show">
                <span id="filter-show" className="filter-label">
                  Show
                </span>
                <Chip
                  pressed={filters.mine}
                  onClick={() => update({ mine: filters.mine ? null : "1" })}
                >
                  Suggested by me
                </Chip>
              </div>
              <div role="group" aria-labelledby="filter-length">
                <span id="filter-length" className="filter-label">
                  Length
                </span>
                {Object.entries(LENGTHS).map(([key, { label }]) => (
                  <Chip
                    key={key}
                    pressed={filters.length === key}
                    onClick={() =>
                      update({ length: filters.length === key ? null : key })
                    }
                  >
                    {label}
                  </Chip>
                ))}
              </div>
              {genres.length > 0 && (
                <div role="group" aria-labelledby="filter-genre">
                  <span id="filter-genre" className="filter-label">
                    Genre
                  </span>
                  {genres.map((genre) => (
                    <Chip
                      key={genre}
                      pressed={filters.genre === genre}
                      onClick={() =>
                        update({ genre: filters.genre === genre ? null : genre })
                      }
                    >
                      {genre}
                    </Chip>
                  ))}
                </div>
              )}
            </div>

            {books.length > 1 && (
              <div className="sort">
                <label htmlFor="sort-field" className="filter-label">
                  Sort by
                </label>
                <div className="sort-controls">
                  <select
                    id="sort-field"
                    value={field}
                    onChange={(e) => {
                      const next = e.target.value as SortField;
                      setSort(next, SORTS[next].defaultOrder);
                    }}
                  >
                    {Object.entries(SORTS).map(([key, { label }]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="sort-order"
                    aria-label={order === "asc" ? "Ascending" : "Descending"}
                    title={order === "asc" ? "Ascending" : "Descending"}
                    onClick={() =>
                      setSort(field, order === "asc" ? "desc" : "asc")
                    }
                  >
                    <span aria-hidden="true">{order === "asc" ? "↑" : "↓"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="catalog-results">
            {shown.length === 0 ? (
              <div className="card catalog-empty">
                <p>No books match those filters.</p>
                <button type="button" onClick={clearFilters}>
                  Clear filters
                </button>
              </div>
            ) : (
              <ul aria-label="Suggested books" className="catalog-list">
                {shown.map((book) => (
                  <SuggestionItem
                    key={book.id}
                    book={book}
                    onBallot={ballot.has(book.id)}
                    selection={selectionFor(book.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {canStartPoll && books && books.length >= MIN_POLL_BOOKS && (
        <div className="pick-bar">
          <p aria-live="polite">
            <strong>
              {selected.length} of {MAX_POLL_BOOKS} selected
            </strong>
            {selected.length < MIN_POLL_BOOKS &&
              ` (pick at least ${MIN_POLL_BOOKS})`}
          </p>
          <button
            type="button"
            className="button-primary"
            disabled={selected.length < MIN_POLL_BOOKS}
            onClick={() => navigate(`/polls/new?books=${selected.join(",")}`)}
          >
            Create a poll from selection
          </button>
        </div>
      )}
    </div>
  );
};

export default SuggestionsPage;
