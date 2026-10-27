import { Link } from "react-router-dom";
import { type SuggestedBookDTO } from "shared";
import { useBookSuggestions } from "../hooks";

const SHOWN = 3;

// "suggested by Dani", "suggested by Dani and 2 others"
const suggesters = (book: SuggestedBookDTO) => {
  const [first, ...rest] = book.suggestedBy;
  if (!first) {
    return null;
  }
  const others =
    rest.length === 0
      ? ""
      : ` and ${rest.length} ${rest.length === 1 ? "other" : "others"}`;
  return `suggested by ${first.firstName}${others}`;
};

// The newest few suggestions. "See all" is the only way to the full list.
const SuggestionsCard = () => {
  const { data: books, error } = useBookSuggestions();
  const newest = books
    ?.slice()
    .sort((a, b) => b.suggestedAt.getTime() - a.suggestedAt.getTime())
    .slice(0, SHOWN);

  return (
    <section className="landing-section" aria-labelledby="suggestions-title">
      <div className="section-head">
        <h2 id="suggestions-title">Suggestions</h2>
        <Link to="/books/suggestions">See all</Link>
      </div>
      {error && <p role="alert">{error.message}</p>}
      {newest?.length === 0 && (
        <p className="muted">No suggestions yet. Got a book in mind?</p>
      )}
      {newest && newest.length > 0 && (
        <ul className="suggestion-list">
          {newest.map((book) => (
            <li key={book.id}>
              <span className="suggestion-title">{book.title}</span>
              <span className="muted">
                {[book.author, suggesters(book)].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link to="/books/suggest" className="button-link button-quiet">
        Suggest a book
      </Link>
    </section>
  );
};

export default SuggestionsCard;
