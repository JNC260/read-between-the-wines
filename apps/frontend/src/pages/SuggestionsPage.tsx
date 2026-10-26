import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  MAX_POLL_BOOKS,
  MIN_POLL_BOOKS,
  type SuggestedBookDTO,
  type SuggesterDTO,
} from "shared";
import { useBookSuggestions, useCurrentPoll } from "../hooks";
import { authClient } from "../lib/auth-client";

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

const suggestedOn = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

// "Ada L., Ben O."
const names = (members: SuggesterDTO[]) =>
  members.map((m) => `${m.firstName} ${m.lastName.charAt(0)}.`).join(", ");

const details = (book: SuggestedBookDTO) =>
  [
    `by ${book.author}`,
    book.yearPublished,
    book.pageCount && `${book.pageCount} pages`,
  ]
    .filter(Boolean)
    .join(" · ");

const closesOn = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

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
  <li>
    {selection && (
      <input
        type="checkbox"
        aria-label={`Select ${book.title} for a poll`}
        checked={selection.checked}
        disabled={selection.disabled}
        onChange={selection.onChange}
      />
    )}
    {book.coverUrl && (
      <img src={book.coverUrl} alt="" width={60} loading="lazy" />
    )}
    <div>
      <h2>{book.title}</h2>
      <p>{details(book)}</p>
      <p>
        Suggested by {names(book.suggestedBy)} on{" "}
        <time dateTime={book.suggestedAt.toISOString()}>
          {suggestedOn.format(book.suggestedAt)}
        </time>
      </p>
      {book.suggestedByMe && <p>You suggested this.</p>}
      {onBallot && <p>On the ballot</p>}
    </div>
  </li>
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

  // replace, so re-sorting doesn't pile up history entries.
  const setSort = (nextField: SortField, nextOrder: SortOrder) =>
    setSearchParams({ sort: nextField, order: nextOrder }, { replace: true });

  return (
    <div>
      <h1>Suggested books</h1>
      <p>
        <Link to="/books/suggest">Suggest a book</Link> ·{" "}
        <Link to="/books/read">Books we've read</Link>
      </p>

      {books && books.length > 1 && (
        <div>
          <label htmlFor="sort-field">Sort by</label>
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
            onClick={() => setSort(field, order === "asc" ? "desc" : "asc")}
          >
            {order === "asc" ? "Ascending" : "Descending"}
          </button>
        </div>
      )}

      {session?.user.isAdmin && currentPoll && (
        <p>
          <Link to={`/polls/${currentPoll.id}`}>A poll is open</Link> until{" "}
          {closesOn.format(currentPoll.closesAt)}. You can start the next one
          once it closes.
        </p>
      )}
      {canStartPoll && books && books.length >= MIN_POLL_BOOKS && (
        <div>
          <p aria-live="polite">
            {selected.length} of {MAX_POLL_BOOKS} selected
            {selected.length < MIN_POLL_BOOKS &&
              ` (pick at least ${MIN_POLL_BOOKS})`}
          </p>
          <button
            type="button"
            disabled={selected.length < MIN_POLL_BOOKS}
            onClick={() => navigate(`/polls/new?books=${selected.join(",")}`)}
          >
            Create a poll from selection
          </button>
        </div>
      )}

      {isPending && <p>Loading...</p>}
      {error && <p role="alert">{error.message}</p>}
      {books?.length === 0 && (
        <p>No suggestions yet. Be the first to suggest a book.</p>
      )}
      {books && books.length > 0 && (
        <ul aria-label="Suggested books">
          {sortBooks(books, field, order).map((book) => (
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
  );
};

export default SuggestionsPage;
