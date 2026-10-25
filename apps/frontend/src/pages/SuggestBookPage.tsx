import { useState } from "react";
import { type BookCandidateDTO, parseGoodreadsUrl } from "shared";
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
  [
    `by ${book.author}`,
    book.yearPublished,
    book.pageCount && `${book.pageCount} pages`,
  ]
    .filter(Boolean)
    .join(" · ");

const SuggestBookPage = () => {
  const [input, setInput] = useState("");
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
    suggest.mutate({
      openLibraryWorkId: book.openLibraryWorkId,
      // Even when the match came from the link's title fallback, it's the
      // book they linked.
      goodreadsUrl: link ? text : undefined,
    });
  };

  const startOver = () => {
    suggest.reset();
    setInput("");
  };

  if (suggest.isSuccess) {
    return (
      <div>
        <h1>Book suggested</h1>
        <p>
          You suggested <strong>{suggest.data.title}</strong>. It can now go on
          a ballot.
        </p>
        <button type="button" onClick={startOver}>
          Suggest another book
        </button>
      </div>
    );
  }

  const results = q ? search.data : undefined;

  return (
    <div>
      <h1>Suggest a book</h1>
      <div>
        <label htmlFor="book-search">Goodreads link or title</label>
        <input
          id="book-search"
          autoComplete="off"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-invalid={badLink}
          aria-describedby="book-search-hint"
        />
        <p id="book-search-hint">
          {badLink
            ? "That isn't a Goodreads book link. It should look like goodreads.com/book/show/…"
            : "Paste a book's Goodreads link, or type its title and author."}
        </p>
      </div>

      {q && search.isFetching && <p>Searching...</p>}
      {q && search.error && <p role="alert">{search.error.message}</p>}
      {suggest.error && <p role="alert">{suggest.error.message}</p>}

      {results && (
        <>
          {results.length === 0 ? (
            <p>No matches found.</p>
          ) : (
            <ul aria-label="Matching books">
              {results.map((book) => {
                const isSuggesting =
                  suggest.isPending &&
                  suggest.variables?.openLibraryWorkId ===
                    book.openLibraryWorkId;
                return (
                  <li key={book.openLibraryWorkId}>
                    {book.coverUrl && (
                      <img src={book.coverUrl} alt="" width={60} loading="lazy" />
                    )}
                    <div>
                      <strong>{book.title}</strong>
                      <p>{details(book)}</p>
                      {book.suggestedByMe ? (
                        <p>You've already suggested this.</p>
                      ) : (
                        <>
                          {book.alreadySuggested && (
                            <p>Another member has suggested this.</p>
                          )}
                          <button
                            type="button"
                            aria-label={`Suggest ${book.title}`}
                            disabled={suggest.isPending}
                            onClick={() => pick(book)}
                          >
                            {isSuggesting ? "Suggesting..." : "Suggest"}
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {/* TODO: manual entry form, once the backend accepts it */}
          <p>Can't find it? Entering a book by hand is coming soon.</p>
        </>
      )}
    </div>
  );
};

export default SuggestBookPage;
