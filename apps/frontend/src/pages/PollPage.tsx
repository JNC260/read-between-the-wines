import { type FormEvent, useId, useState } from "react";
import { useParams } from "react-router-dom";
import { type BookDTO, type PollDTO } from "shared";
import BookCover from "../components/BookCover";
import { AssignBook, PollAdminActions } from "../components/PollAdmin";
import { useCastVotes, useMeetings, usePoll } from "../hooks";
import { authClient } from "../lib/auth-client";

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
  [book.yearPublished, book.pageCount && `${book.pageCount} pages`]
    .filter(Boolean)
    .join(" · ");

// Open Library synopses separate paragraphs with blank lines.
const paragraphs = (text: string) =>
  text.split(/\n\s*\n/).filter((p) => p.trim());

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Long enough to need a "Read more": more than one paragraph, or more than
// about a line of one on a phone.
const isLong = (text: string) =>
  paragraphs(text).length > 1 || text.length > 45;

// The synopsis starts at one line, so even a six-book ballot fits in a few
// screens. All of it stays in the page, so a screen reader still hears the
// whole thing.
const BookDetails = ({ book }: { book: BookDTO }) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  const long = !!book.synopsis && isLong(book.synopsis);
  return (
    <>
      <div className="poll-book-cover">
        <BookCover book={book} />
      </div>
      <div className="poll-book-text">
        <h2>{book.title}</h2>
        <p className="byline">{book.author}</p>
        {details(book) && <p className="poll-book-meta">{details(book)}</p>}
        {book.synopsis && (
          <div
            id={id}
            className={`poll-synopsis${long && !open ? " is-clamped" : ""}`}
          >
            {paragraphs(book.synopsis).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
        <div className="poll-book-links">
          {long && (
            <button
              type="button"
              className="poll-more"
              aria-expanded={open}
              aria-controls={id}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? "Show less" : "Read more"}
            </button>
          )}
          <a href={goodreadsLink(book)} target="_blank" rel="noreferrer">
            {/* Screen readers hear which book; the page just says Goodreads. */}
            <span className="visually-hidden">{book.title} on</span> Goodreads{" "}
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </>
  );
};

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
    <form onSubmit={handleSubmit} className="poll-form">
      <p className="poll-intro">
        Pick up to {plural(poll.votesPerMember, "book")}. You can change your
        votes until {closesOn.format(poll.closesAt)}.
      </p>
      <ul aria-label="Ballot" className="poll-books">
        {poll.books.map((book) => {
          const checked = picked.includes(book.id);
          return (
            <li
              key={book.id}
              className={`card poll-book${checked ? " is-picked" : ""}`}
            >
              <BookDetails book={book} />
              <label className="poll-vote">
                <input
                  type="checkbox"
                  aria-label={`Vote for ${book.title}`}
                  checked={checked}
                  disabled={full && !checked}
                  onChange={() => toggle(book.id)}
                />
                <span aria-hidden="true">{checked ? "Your pick" : "Vote"}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {/* Follows the member down the ballot, with any error just above it. */}
      <div className="poll-submit">
        {error && (
          <p role="alert" className="poll-submit-note">
            {error.message}
          </p>
        )}
        <div className="pick-bar">
          {isSuccess ? (
            <p role="status">Your votes are saved.</p>
          ) : (
            <p aria-live="polite">
              <strong>
                {picked.length} of {poll.votesPerMember}
              </strong>{" "}
              picked
            </p>
          )}
          <button
            type="submit"
            className="button-primary"
            disabled={isPending || picked.length === 0}
          >
            {isPending
              ? "Saving..."
              : hasVoted
                ? "Update votes"
                : "Submit votes"}
          </button>
        </div>
      </div>
    </form>
  );
};

// results is only sent once the poll has closed, most votes first. Each bar
// is measured against the top book, so the winner's always fills its row.
const Results = ({ poll, isAdmin }: { poll: PollDTO; isAdmin: boolean }) => {
  const byId = new Map(poll.books.map((b) => [b.id, b]));
  const upcoming = useMeetings("upcoming");
  const results = poll.results ?? [];
  const most = Math.max(0, ...results.map((r) => r.votes));
  return (
    <>
      <p className="poll-intro">
        Voting closed {closesOn.format(poll.closesAt)}.
      </p>
      <ol aria-label="Results" className="poll-books">
        {results.map(({ bookId, votes }) => {
          const book = byId.get(bookId);
          const top = most > 0 && votes === most;
          return (
            book && (
              <li
                key={bookId}
                className={`card poll-result${top ? " is-top" : ""}`}
              >
                <div className="poll-book-cover">
                  <BookCover book={book} />
                </div>
                <div className="poll-book-text">
                  {top && <p className="poll-result-tag">Most votes</p>}
                  <h2>{book.title}</h2>
                  <p className="byline">{book.author}</p>
                  <div className="poll-result-bar" aria-hidden="true">
                    <span
                      style={{ width: `${most ? (votes / most) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="poll-result-count">
                    {plural(votes, "vote")}
                    {poll.myVotes.includes(bookId) && (
                      <span className="badge badge-mine">Your vote</span>
                    )}
                  </p>
                  {upcoming.data && (
                    <AssignBook
                      pollId={poll.id}
                      bookId={book.id}
                      bookTitle={book.title}
                      meetingId={book.meetingId}
                      upcoming={upcoming.data}
                      isAdmin={isAdmin}
                    />
                  )}
                </div>
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
  const { data: session } = authClient.useSession();
  const isAdmin = !!session?.user.isAdmin;

  if (isPending) {
    return <p>Loading...</p>;
  }
  if (error) {
    return <p role="alert">{error.message}</p>;
  }

  return (
    <div className="poll-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            {poll.isOpen ? "Book poll" : "Poll results"}
          </p>
          <h1>{poll.theme ?? "Pick our next book"}</h1>
          <p className="muted">
            {plural(poll.voterCount, "member")} voted
            {poll.isOpen && " so far"}.
          </p>
        </div>
      </div>
      {isAdmin && <PollAdminActions poll={poll} />}
      {poll.isOpen ? (
        // key: start the ballot over if a different poll loads.
        <Ballot key={poll.id} poll={poll} />
      ) : (
        <Results poll={poll} isAdmin={isAdmin} />
      )}
    </div>
  );
};

export default PollPage;
