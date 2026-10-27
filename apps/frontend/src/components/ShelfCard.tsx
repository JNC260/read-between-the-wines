import { Link } from "react-router-dom";
import { type ReadBookDTO } from "shared";
import { useReadBooks } from "../hooks";

const SHOWN = 12;
const since = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});

// Spine height and width from the title, so the same book always looks the
// same and the shelf isn't a row of identical blocks.
const spineSize = (title: string) => {
  let hash = 0;
  for (const ch of title) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return {
    height: `${6 + (hash % 5) * 0.5}rem`,
    width: `${1.4 + Math.min(title.length, 24) * 0.03}rem`,
  };
};

const caption = (books: ReadBookDTO[]) => {
  const first = books[books.length - 1];
  const count = `${books.length} ${books.length === 1 ? "book" : "books"}`;
  return `${count} since ${since.format(first.meetingStart)}`;
};

// Books from meetings that have started, newest on the left. "See all" is
// the only way to the full list.
const ShelfCard = () => {
  const { data, error } = useReadBooks();
  const now = new Date();
  const read = data?.filter((b) => b.meetingStart <= now);

  return (
    <section className="landing-section" aria-labelledby="shelf-title">
      <div className="section-head">
        <h2 id="shelf-title">Our shelf</h2>
        <Link to="/books/read">See all</Link>
      </div>
      {error && <p role="alert">{error.message}</p>}
      {read?.length === 0 && (
        <p className="muted">
          Books land here once we've met to talk about them.
        </p>
      )}
      {read && read.length > 0 && (
        <>
          <ul className="shelf" aria-label="Books we've read">
            {read.slice(0, SHOWN).map((book, i) => (
              <li
                key={book.id}
                className={`spine spine-${i % 6}`}
                style={spineSize(book.title)}
                title={`${book.title} by ${book.author}`}
              >
                <span>{book.title}</span>
              </li>
            ))}
          </ul>
          <p className="muted shelf-caption">{caption(read)}</p>
        </>
      )}
    </section>
  );
};

export default ShelfCard;
