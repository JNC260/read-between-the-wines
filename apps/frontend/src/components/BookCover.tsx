import { useState } from "react";
import { type BookDTO } from "shared";

type Props = {
  book: Pick<BookDTO, "title" | "author" | "coverUrl">;
};

const lastWord = (name: string) => name.trim().split(/\s+/).pop() ?? name;

// The real cover when Open Library has one; otherwise a plain cover in the
// accent color with the title and author's surname. Decorative either way:
// the title is always printed next to it.
const BookCover = ({ book }: Props) => {
  const [failed, setFailed] = useState(false);

  if (book.coverUrl && !failed) {
    return (
      <img
        className="book-cover"
        src={book.coverUrl}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        // Open Library answers a missing cover with a 1x1 blank image
        // instead of an error.
        onLoad={(e) => e.currentTarget.naturalWidth <= 1 && setFailed(true)}
      />
    );
  }
  return (
    <div className="book-cover book-cover-plain" aria-hidden="true">
      <b>{book.title}</b>
      <small>{lastWord(book.author)}</small>
    </div>
  );
};

export default BookCover;
