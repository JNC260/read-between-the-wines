import { type ChangeEvent, type FormEvent, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import * as z from "zod";
import { type BookDetailDTO, type Genre, isGenre, UpdateBookSchema } from "shared";
import Field from "../components/Field";
import GenrePicker from "../components/GenrePicker";
import { useBook, useUpdateBook } from "../hooks";

type FieldName =
  | "title"
  | "author"
  | "yearPublished"
  | "pageCount"
  | "genres"
  | "synopsis"
  | "coverUrl"
  | "goodreadsUrl";

type TextField = Exclude<FieldName, "genres">;

const initialValues = (book: BookDetailDTO): Record<TextField, string> => ({
  title: book.title,
  author: book.author,
  yearPublished: book.yearPublished?.toString() ?? "",
  pageCount: book.pageCount?.toString() ?? "",
  synopsis: book.synopsis ?? "",
  coverUrl: book.coverUrl ?? "",
  goodreadsUrl: book.goodreadsUrl ?? "",
});

// Rendered once the book has loaded, since `book` only seeds the inputs.
const BookForm = ({
  book,
  onSaved,
}: {
  book: BookDetailDTO;
  onSaved: () => void;
}) => {
  const { mutate, isPending, error } = useUpdateBook();
  const [values, setValues] = useState(() => initialValues(book));
  // Genres from before the club's list are dropped here, so saving cleans
  // them up.
  const [genres, setGenres] = useState<Genre[]>(() =>
    book.genres.filter(isGenre),
  );
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FieldName, string[]>>
  >({});

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Every field is sent, so an emptied input clears it (null) rather than
    // leaving the old value. Title and author can't be cleared; the schema
    // says so if they're blank.
    const orNull = (value: string) => (value.trim() === "" ? null : value);
    const orNumber = (value: string) =>
      value.trim() === "" ? null : Number(value);
    const body = {
      title: values.title,
      author: values.author,
      // A typo like "20l1" becomes NaN, which the schema rejects.
      yearPublished: orNumber(values.yearPublished),
      pageCount: orNumber(values.pageCount),
      genres,
      synopsis: orNull(values.synopsis),
      coverUrl: orNull(values.coverUrl),
      goodreadsUrl: orNull(values.goodreadsUrl),
    };
    const result = UpdateBookSchema.safeParse(body);
    if (!result.success) {
      setFieldErrors(z.flattenError(result.error).fieldErrors);
      return;
    }
    setFieldErrors({});
    mutate({ id: book.id, ...result.data }, { onSuccess: onSaved });
  };

  // The props every input shares.
  const bind = (name: TextField) => ({
    id: name,
    value: values[name],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [name]: e.target.value })),
    error: fieldErrors[name]?.[0],
  });

  const synopsis = bind("synopsis");

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Field {...bind("title")} label="Title" />
      <Field {...bind("author")} label="Author" />
      <Field
        {...bind("yearPublished")}
        label="Year published"
        inputMode="numeric"
      />
      <Field {...bind("pageCount")} label="Pages" inputMode="numeric" />
      <GenrePicker
        value={genres}
        onChange={setGenres}
        error={fieldErrors.genres?.[0]}
      />
      <div>
        <label htmlFor="synopsis">Synopsis</label>
        <textarea
          id="synopsis"
          rows={8}
          value={synopsis.value}
          onChange={synopsis.onChange}
          aria-invalid={!!synopsis.error}
          aria-describedby={synopsis.error ? "synopsis-error" : undefined}
        />
        {synopsis.error && (
          <p id="synopsis-error" role="alert">
            {synopsis.error}
          </p>
        )}
      </div>
      <Field {...bind("coverUrl")} label="Cover image link" type="url" />
      <Field {...bind("goodreadsUrl")} label="Goodreads link" type="url" />

      {error && <p role="alert">{error.message}</p>}
      <button type="submit" className="button-primary" disabled={isPending}>
        {isPending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
};

// Linked from the suggested and read book lists, for members who suggested
// the book and for admins. The API makes the same check.
const EditBookPage = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const book = useBook(id);

  // Back to whichever list they came from; a direct visit has nowhere to go
  // back to, so it lands on the suggestions.
  const goBack = () =>
    location.key === "default" ? navigate("/books/suggestions") : navigate(-1);

  if (book.isPending) {
    return <p>Loading...</p>;
  }
  if (book.isError) {
    return <p role="alert">{book.error.message}</p>;
  }
  if (!book.data.canEdit) {
    return (
      <div>
        <h1>Edit book</h1>
        <p>
          Only members who suggested <em>{book.data.title}</em>, or an admin,
          can edit it.
        </p>
        <Link to="/books/suggestions">Back to suggested books</Link>
      </div>
    );
  }

  return (
    <div>
      <h1>Edit {book.data.title}</h1>
      <p>Changes show for everyone, including anyone else who suggested it.</p>
      <BookForm book={book.data} onSaved={goBack} />
      <button type="button" onClick={goBack}>
        Cancel
      </button>
    </div>
  );
};

export default EditBookPage;
