import { type CSSProperties, useState } from "react";
import { Link } from "react-router-dom";
import { type ReadBookDTO } from "shared";
import BookCover from "../components/BookCover";
import Bookend, { BOOKEND_KINDS } from "../components/Bookend";
import { useRateBook, useReadBooks } from "../hooks";
import { authClient } from "../lib/auth-client";

const discussedOn = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const upNextOn = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const monthOf = new Intl.DateTimeFormat(undefined, { month: "short" });
const monthYear = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});
const sinceMonth = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
});
const count = new Intl.NumberFormat();

const SCORES = [1, 2, 3, 4, 5];

// Spine colors, [background, text], from the site palette plus a green and
// a blue so a shelf doesn't run all pink. Every pair passes 4.5:1.
const SPINE_COLORS = [
  ["#241B3A", "#FFF6F7"],
  ["#C81D6B", "#FFFFFF"],
  ["#F29E38", "#2A1A05"],
  ["#FFD3E2", "#241B3A"],
  ["#2E5E4E", "#FFF6F7"],
  ["#34507A", "#FFFFFF"],
  ["#F3E3C3", "#241B3A"],
  ["#6B2D5C", "#FFFFFF"],
];

// Picked from the id, so a book keeps its color even if its title is edited.
const spineStyle = (book: ReadBookDTO): CSSProperties => {
  let hash = 0;
  for (const c of book.id) {
    hash = (hash * 31 + c.charCodeAt(0)) % 9973;
  }
  const [background, color] = SPINE_COLORS[hash % SPINE_COLORS.length];
  // Longer books stand taller and thicker; an unknown length sits mid-shelf.
  const t = Math.min(1, Math.max(0, ((book.pageCount ?? 340) - 170) / 410));
  return {
    background,
    color,
    width: `${Math.round(28 + t * 20)}px`,
    height: `${Math.round(168 + t * 70)}px`,
  };
};

const pagesIn = (books: ReadBookDTO[]) =>
  books.reduce((sum, b) => sum + (b.pageCount ?? 0), 0);

type Shelf = { year: number; books: ReadBookDTO[] };

// One shelf per meeting year, newest year on top, each filled left to right
// in the order the club read them. The API sends latest meeting first.
const shelvesOf = (books: ReadBookDTO[]): Shelf[] => {
  const shelves: Shelf[] = [];
  for (const book of books) {
    const year = book.meetingStart.getFullYear();
    const shelf = shelves.find((s) => s.year === year);
    if (shelf) {
      shelf.books.unshift(book);
    } else {
      shelves.push({ year, books: [book] });
    }
  }
  return shelves;
};

const plural = (n: number, word: string) =>
  `${count.format(n)} ${n === 1 ? word : `${word}s`}`;

// "4.3 / 5 from 3 ratings"
const average = (book: ReadBookDTO) =>
  book.averageRating === null
    ? "Not rated yet"
    : `${book.averageRating.toFixed(1)} / 5 from ${plural(book.ratingCount, "rating")}`;

// Five buttons, filled up to the member's score. While a new score saves,
// it shows that one so the click feels instant.
const RateBook = ({ book }: { book: ReadBookDTO }) => {
  const { mutate, isPending, variables, error } = useRateBook();
  const shown = isPending ? variables.score : book.myRating;

  return (
    <div>
      <div
        role="group"
        aria-label={`Your rating for ${book.title}`}
        className="rating-stars"
      >
        {SCORES.map((score) => (
          <button
            key={score}
            type="button"
            className="rating-star"
            aria-label={`${score} ${score === 1 ? "star" : "stars"}`}
            aria-pressed={book.myRating === score}
            disabled={isPending}
            onClick={() => mutate({ bookId: book.id, score })}
          >
            {shown !== null && score <= shown ? "★" : "☆"}
          </button>
        ))}
      </div>
      {error && <p role="alert">{error.message}</p>}
    </div>
  );
};

const UpNext = ({ book }: { book: ReadBookDTO }) => (
  <section className="up-next" aria-label="Up next">
    <div className="up-next-cover">
      <BookCover book={book} />
    </div>
    <div className="up-next-text">
      <p className="up-next-tag">Up next · {upNextOn.format(book.meetingStart)}</p>
      <h2>{book.title}</h2>
      <p>
        {[
          book.author,
          book.pageCount && `${book.pageCount} pages`,
          book.yearPublished && `published ${book.yearPublished}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
    <Link to={`/events/${book.meetingId}`} className="button-link up-next-link">
      See the event
    </Link>
  </section>
);

const Spine = ({
  book,
  picked,
  isNext,
  onPick,
}: {
  book: ReadBookDTO;
  picked: boolean;
  isNext: boolean;
  onPick: () => void;
}) => (
  <button
    type="button"
    className={`book-spine${picked ? " is-picked" : ""}`}
    style={spineStyle(book)}
    aria-pressed={picked}
    aria-controls="book-details"
    aria-label={`${book.title} by ${book.author}, ${
      isNext ? "up next in" : "discussed in"
    } ${monthYear.format(book.meetingStart)}`}
    onClick={onPick}
  >
    {isNext && <span className="book-spine-flag">Up next</span>}
    <span className="book-spine-band" />
    <span className="book-spine-title">{book.title}</span>
    <span className="book-spine-band" />
    <span className="book-spine-month">{monthOf.format(book.meetingStart)}</span>
  </button>
);

const BookDetails = ({
  book,
  now,
  canEdit,
}: {
  book: ReadBookDTO;
  now: Date;
  canEdit: boolean;
}) => (
  <div className="card book-details">
    <div className="book-details-head">
      <div className="book-details-cover">
        <BookCover book={book} />
      </div>
      <div>
        <p className="book-details-when">
          {book.meetingStart > now
            ? `Up next · ${upNextOn.format(book.meetingStart)}`
            : `Discussed ${discussedOn.format(book.meetingStart)}`}
        </p>
        <h2>{book.title}</h2>
        <p className="byline">{book.author}</p>
      </div>
    </div>
    <dl className="book-details-facts">
      <div>
        <dt>Pages</dt>
        <dd>{book.pageCount ?? "Not listed"}</dd>
      </div>
      <div>
        <dt>Published</dt>
        <dd>{book.yearPublished ?? "Not listed"}</dd>
      </div>
    </dl>
    <h3>Club rating</h3>
    <p className="muted">{average(book)}</p>
    <RateBook book={book} />
    <div className="book-details-links">
      <Link to={`/events/${book.meetingId}`} className="button-link">
        See the meeting
      </Link>
      {canEdit && (
        <Link to={`/books/${book.id}/edit`} className="button-link button-outline">
          Edit book
        </Link>
      )}
    </div>
  </div>
);

const ReadBooksPage = () => {
  const { data: books, isPending, error } = useReadBooks();
  const { data: session } = authClient.useSession();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const now = new Date();

  const discussed = books?.filter((b) => b.meetingStart <= now) ?? [];
  // Latest meeting first, so the soonest upcoming one is the last of those.
  const next = books?.filter((b) => b.meetingStart > now).at(-1);
  // Until a spine is picked, show the book most recently talked about.
  const picked =
    books?.find((b) => b.id === pickedId) ?? discussed[0] ?? books?.[0];
  const oldest = discussed.at(-1);

  return (
    <div className="read-page">
      <div className="page-head">
        <div>
          {oldest && (
            <p className="eyebrow">
              {plural(discussed.length, "book")} ·{" "}
              {plural(pagesIn(discussed), "page")} · since{" "}
              {sinceMonth.format(oldest.meetingStart)}
            </p>
          )}
          <h1>The club shelf</h1>
          <p className="muted">
            One shelf a year, filled left to right as we go. Pull any book off
            the shelf to see it.
          </p>
        </div>
      </div>

      {isPending && <p>Loading...</p>}
      {error && <p role="alert">{error.message}</p>}
      {books?.length === 0 && <p>No books read yet.</p>}

      {next && <UpNext book={next} />}

      {books && books.length > 0 && picked && (
        <div className="shelf-layout">
          <div className="shelves">
            {shelvesOf(books).map((shelf, i) => (
              <section
                key={shelf.year}
                className="read-shelf"
                aria-labelledby={`shelf-${shelf.year}`}
              >
                <div className="shelf-head">
                  <h2 id={`shelf-${shelf.year}`}>{shelf.year}</h2>
                  <p className="muted">
                    {plural(shelf.books.length, "book")} ·{" "}
                    {plural(pagesIn(shelf.books), "page")}
                  </p>
                </div>
                <div className="shelf-scroll">
                  <div className="shelf-row">
                    {shelf.books.map((book) => (
                      <Spine
                        key={book.id}
                        book={book}
                        picked={book.id === picked.id}
                        isNext={book.id === next?.id}
                        onPick={() => setPickedId(book.id)}
                      />
                    ))}
                    <Bookend kind={BOOKEND_KINDS[i % BOOKEND_KINDS.length]} />
                  </div>
                </div>
                <div className="shelf-plank" />
              </section>
            ))}
          </div>

          <aside id="book-details" className="shelf-aside" aria-label="Book details" aria-live="polite">
            {/* Keyed so a rating error doesn't follow you to the next book. */}
            <BookDetails
              key={picked.id}
              book={picked}
              now={now}
              canEdit={picked.suggestedByMe || !!session?.user.isAdmin}
            />
          </aside>
        </div>
      )}
    </div>
  );
};

export default ReadBooksPage;
