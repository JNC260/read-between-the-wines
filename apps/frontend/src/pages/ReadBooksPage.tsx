import { Link } from "react-router-dom";
import { type ReadBookDTO } from "shared";
import { useReadBooks } from "../hooks";

const meetingDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const details = (book: ReadBookDTO) =>
  [
    `by ${book.author}`,
    book.yearPublished,
    book.pageCount && `${book.pageCount} pages`,
  ]
    .filter(Boolean)
    .join(" · ");

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
