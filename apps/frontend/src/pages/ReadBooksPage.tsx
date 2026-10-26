import { Link } from "react-router-dom";
import { type ReadBookDTO } from "shared";
import { useRateBook, useReadBooks } from "../hooks";

const meetingDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const SCORES = [1, 2, 3, 4, 5];

const details = (book: ReadBookDTO) =>
  [
    `by ${book.author}`,
    book.yearPublished,
    book.pageCount && `${book.pageCount} pages`,
  ]
    .filter(Boolean)
    .join(" · ");

// "4.3 / 5 from 3 ratings"
const average = (book: ReadBookDTO) =>
  book.averageRating === null
    ? "Not rated yet"
    : `${book.averageRating.toFixed(1)} / 5 from ${book.ratingCount} ${
        book.ratingCount === 1 ? "rating" : "ratings"
      }`;

// Five buttons, filled up to the member's score. While a new score saves,
// it shows that one so the click feels instant.
const RateBook = ({ book }: { book: ReadBookDTO }) => {
  const { mutate, isPending, variables, error } = useRateBook();
  const shown = isPending ? variables.score : book.myRating;

  return (
    <div>
      <div role="group" aria-label={`Your rating for ${book.title}`}>
        Your rating:{" "}
        {SCORES.map((score) => (
          <button
            key={score}
            type="button"
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

// A book whose meeting hasn't started yet is the one being read now.
const ReadBookItem = ({ book, now }: { book: ReadBookDTO; now: Date }) => (
  <li>
    {book.coverUrl && (
      <img src={book.coverUrl} alt="" width={60} loading="lazy" />
    )}
    <div>
      <h2>{book.title}</h2>
      <p>{details(book)}</p>
      <p>
        {book.meetingStart > now ? "Up next: " : "Discussed "}
        <time dateTime={book.meetingStart.toISOString()}>
          {meetingDate.format(book.meetingStart)}
        </time>
      </p>
      <p>Club rating: {average(book)}</p>
      <RateBook book={book} />
    </div>
  </li>
);

const ReadBooksPage = () => {
  const { data: books, isPending, error } = useReadBooks();
  const now = new Date();

  return (
    <div>
      <h1>Books we've read</h1>
      <p>
        <Link to="/books/suggestions">Suggested books</Link>
      </p>
      {isPending && <p>Loading...</p>}
      {error && <p role="alert">{error.message}</p>}
      {books?.length === 0 && <p>No books read yet.</p>}
      {books && books.length > 0 && (
        <ul aria-label="Books we've read">
          {books.map((book) => (
            <ReadBookItem key={book.id} book={book} now={now} />
          ))}
        </ul>
      )}
    </div>
  );
};

export default ReadBooksPage;
