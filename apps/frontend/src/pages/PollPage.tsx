import { type FormEvent, useState } from "react";
import { useParams } from "react-router-dom";
import { type BookDTO, type PollDTO } from "shared";
import { useCastVotes, usePoll } from "../hooks";

const closesOn = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

// Most books only have a Goodreads link if whoever suggested it pasted one,
// so fall back to a Goodreads search for the title and author.
export const goodreadsLink = (book: BookDTO) =>
  book.goodreadsUrl ??
  `https://www.goodreads.com/search?q=${encodeURIComponent(
    `${book.title} ${book.author}`,
  )}`;

const details = (book: BookDTO) =>
  [
    `by ${book.author}`,
    book.yearPublished,
    book.pageCount && `${book.pageCount} pages`,
  ]
    .filter(Boolean)
    .join(" · ");

// Open Library synopses separate paragraphs with blank lines.
const paragraphs = (text: string) =>
  text.split(/\n\s*\n/).filter((p) => p.trim());

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const BookDetails = ({ book }: { book: BookDTO }) => (
  <>
    {book.coverUrl && (
      <img src={book.coverUrl} alt="" width={80} loading="lazy" />
    )}
    <div>
      <h2>{book.title}</h2>
      <p>{details(book)}</p>
      {book.synopsis &&
        paragraphs(book.synopsis).map((text, i) => <p key={i}>{text}</p>)}
      <a href={goodreadsLink(book)} target="_blank" rel="noreferrer">
        {book.title} on Goodreads
      </a>
    </div>
  </>
);

// Starts from the member's saved votes; submitting replaces them all.
const Ballot = ({ poll }: { poll: PollDTO }) => {
  const { mutate, isPending, isSuccess, error, reset } = useCastVotes();
  const [picked, setPicked] = useState<string[]>(poll.myVotes);
  const full = picked.length >= poll.votesPerMember;
  const hasVoted = poll.myVotes.length > 0;

  const toggle = (id: string) => {
    reset();
    setPicked((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id],
    );
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    mutate({ pollId: poll.id, bookIds: picked });
  };

  return (
    <form onSubmit={handleSubmit}>
      <p>
        Pick up to {plural(poll.votesPerMember, "book")}. You can change your
        votes until {closesOn.format(poll.closesAt)}.
      </p>
      <ul aria-label="Ballot">
        {poll.books.map((book) => {
          const checked = picked.includes(book.id);
          return (
            <li key={book.id}>
              <input
                type="checkbox"
                aria-label={`Vote for ${book.title}`}
                checked={checked}
                disabled={full && !checked}
                onChange={() => toggle(book.id)}
              />
              <BookDetails book={book} />
            </li>
          );
        })}
      </ul>
      <p aria-live="polite">
        {picked.length} of {poll.votesPerMember} picked
      </p>
      {error && <p role="alert">{error.message}</p>}
      {isSuccess && <p role="status">Your votes are saved.</p>}
      <button type="submit" disabled={isPending || picked.length === 0}>
        {isPending ? "Saving..." : hasVoted ? "Update votes" : "Submit votes"}
      </button>
    </form>
  );
};

// results is only sent once the poll has closed, most votes first.
const Results = ({ poll }: { poll: PollDTO }) => {
  const byId = new Map(poll.books.map((b) => [b.id, b]));
  return (
    <>
      <p>Voting closed {closesOn.format(poll.closesAt)}.</p>
      <ol aria-label="Results">
        {(poll.results ?? []).map(({ bookId, votes }) => {
          const book = byId.get(bookId);
          return (
            book && (
              <li key={bookId}>
                <strong>{book.title}</strong> by {book.author}:{" "}
                {plural(votes, "vote")}
                {poll.myVotes.includes(bookId) && " (you voted for this)"}
              </li>
            )
          );
        })}
      </ol>
    </>
  );
};

const PollPage = () => {
  const { id = "" } = useParams();
  const { data: poll, isPending, error } = usePoll(id);

  if (isPending) {
    return <p>Loading...</p>;
  }
  if (error) {
    return <p role="alert">{error.message}</p>;
  }

  return (
    <div>
      <h1>{poll.theme ? `Book poll: ${poll.theme}` : "Book poll"}</h1>
      <p>
        {plural(poll.voterCount, "member")} voted
        {poll.isOpen && " so far"}.
      </p>
      {poll.isOpen ? (
        // key: start the ballot over if a different poll loads.
        <Ballot key={poll.id} poll={poll} />
      ) : (
        <Results poll={poll} />
      )}
    </div>
  );
};

export default PollPage;
