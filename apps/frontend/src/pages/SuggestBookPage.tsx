import { useState } from "react";
import { Link } from "react-router-dom";
import { type BookCandidateDTO, type BookDTO, parseGoodreadsUrl } from "shared";
import BookCover from "../components/BookCover";
import ManualBookForm, { type ManualBookStart } from "../components/ManualBookForm";
import {
  useBookSearch,
  useCreateBookSuggestion,
  useDebouncedValue,
} from "../hooks";

// Long enough to finish a word before searching.
const TYPING_DELAY_MS = 400;
const MIN_TITLE_LENGTH = 2;

// Something meant as a link, so a parse failure is worth pointing out
// instead of searching for it as a title.
const looksLikeUrl = (text: string) =>
  /^https?:\/\//i.test(text) || /goodreads\.com/i.test(text);

const details = (book: BookCandidateDTO) =>
  [book.yearPublished, book.pageCount && `${book.pageCount} pages`]
    .filter(Boolean)
    .join(" · ");

// "the secret history" -> "The Secret History", for a title taken from a
// link's slug.
const titleCase = (words: string) =>
  words.replace(/(^|\s)\S/g, (c) => c.toUpperCase());

// What the manual form starts with: a typed title as the title, or a pasted
// link as the link, with the title its slug spells out.
const manualStart = (text: string): ManualBookStart => {
  const link = parseGoodreadsUrl(text);
  if (link) {
    return { title: titleCase(link.titleHint ?? ""), goodreadsUrl: text };
  }
  return { title: looksLikeUrl(text) ? "" : text, goodreadsUrl: "" };
};

const Suggested = ({
  book,
  onAnother,
}: {
  book: BookDTO;
  onAnother: () => void;
}) => (
  <div className="suggest-page">
    <div className="card suggest-done">
      <div className="suggest-done-cover">
        <BookCover book={book} />
      </div>
      <div>
        <h1>Book suggested</h1>
        <p>
          You suggested <strong>{book.title}</strong>. It can now go on a
          ballot.
        </p>
        <div className="suggest-done-actions">
          <button type="button" className="button-primary" onClick={onAnother}>
            Suggest another book
          </button>
          <Link to="/books/suggestions" className="button-link button-quiet">
            See all suggestions
          </Link>
        </div>
      </div>
    </div>
  </div>
);

const Candidate = ({
  book,
  isSuggesting,
  disabled,
  onPick,
}: {
  book: BookCandidateDTO;
  isSuggesting: boolean;
  disabled: boolean;
  onPick: () => void;
}) => (
  <li className="card candidate">
    <div className="candidate-cover">
      <BookCover book={book} />
    </div>
    <div className="candidate-text">
      <h2>{book.title}</h2>
      <p className="byline">{book.author}</p>
      {details(book) && <p className="candidate-meta">{details(book)}</p>}
      {book.suggestedByMe ? (
        <p className="candidate-note">You've already suggested this.</p>
      ) : (
        book.alreadySuggested && (
          <p className="candidate-note">Another member has suggested this.</p>
        )
      )}
    </div>
    {!book.suggestedByMe && (
      <button
        type="button"
        className="button-primary candidate-pick"
        aria-label={`Suggest ${book.title}`}
        disabled={disabled}
        onClick={onPick}
      >
        {isSuggesting ? "Suggesting..." : "Suggest"}
      </button>
    )}
  </li>
);

const SuggestBookPage = () => {
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [suggested, setSuggested] = useState<BookDTO | null>(null);
  const suggest = useCreateBookSuggestion();

  const text = input.trim();
  const link = parseGoodreadsUrl(text);
  const badLink = !link && looksLikeUrl(text);
  // A pasted link searches straight away; typing waits for a pause. Bad
  // links and very short text never reach the debounced value.
  const typed = useDebouncedValue(
    badLink || text.length < MIN_TITLE_LENGTH ? "" : text,
    TYPING_DELAY_MS,
  );
  const q = link ? text : typed;
  const search = useBookSearch(q);

  const pick = (book: BookCandidateDTO) => {
    suggest.mutate(
      {
        openLibraryWorkId: book.openLibraryWorkId,
        // Even when the match came from the link's title fallback, it's the
        // book they linked.
        goodreadsUrl: link ? text : undefined,
      },
      { onSuccess: setSuggested },
    );
  };

  const startOver = () => {
    suggest.reset();
    setSuggested(null);
    setAdding(false);
    setInput("");
  };

  if (suggested) {
    return <Suggested book={suggested} onAnother={startOver} />;
  }

  const results = q ? search.data : undefined;

  return (
    <div className="suggest-page">
      <p className="back-link">
        <Link to="/books/suggestions">← Suggested books</Link>
      </p>
      <div className="page-head">
        <div>
          <h1>Suggest a book</h1>
          {!adding && (
            <p className="muted">
              We'll fill in the cover, length and synopsis for you.
            </p>
          )}
        </div>
      </div>

      {adding ? (
        <ManualBookForm
          start={manualStart(text)}
          onSuggested={setSuggested}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <>
          <div className="suggest-search">
            <label htmlFor="book-search">Goodreads link or title</label>
            <div className="search">
              <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M20 20l-4.2-4.2" />
              </svg>
              <input
                id="book-search"
                type="search"
                autoComplete="off"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                aria-invalid={badLink}
                aria-describedby="book-search-hint"
              />
            </div>
            <p
              id="book-search-hint"
              className={`suggest-hint${badLink ? " is-error" : ""}`}
            >
              {badLink
                ? "That isn't a Goodreads book link. It should look like goodreads.com/book/show/…"
                : "Paste a book's Goodreads link, or type its title and author."}
            </p>
          </div>

          {q && search.isFetching && <p className="muted">Searching...</p>}
          {q && search.error && <p role="alert">{search.error.message}</p>}
          {suggest.error && <p role="alert">{suggest.error.message}</p>}

          {results &&
            (results.length === 0 ? (
              <p className="muted">No matches found.</p>
            ) : (
              <ul aria-label="Matching books" className="candidate-list">
                {results.map((book) => (
                  <Candidate
                    key={book.openLibraryWorkId}
                    book={book}
                    isSuggesting={
                      suggest.isPending &&
                      suggest.variables?.openLibraryWorkId ===
                        book.openLibraryWorkId
                    }
                    disabled={suggest.isPending}
                    onPick={() => pick(book)}
                  />
                ))}
              </ul>
            ))}

          <p className="suggest-manual">
            Can't find it?{" "}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                suggest.reset();
                setAdding(true);
              }}
            >
              Add it yourself
            </button>
          </p>
        </>
      )}
    </div>
  );
};

export default SuggestBookPage;
