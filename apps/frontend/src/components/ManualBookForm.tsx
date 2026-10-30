import { type ChangeEvent, type FormEvent, useState } from "react";
import * as z from "zod";
import { type BookDTO, ManualBookSuggestionSchema } from "shared";
import { useCreateManualBookSuggestion } from "../hooks";
import Field from "./Field";

type FieldName =
  | "title"
  | "author"
  | "yearPublished"
  | "pageCount"
  | "goodreadsUrl"
  | "synopsis";

export type ManualBookStart = { title: string; goodreadsUrl: string };

// For a book the search can't find. Only the title and author are needed;
// the rest can be filled in now or later on the edit page.
const ManualBookForm = ({
  start,
  onSuggested,
  onCancel,
}: {
  // Whatever the member had typed or pasted into the search.
  start: ManualBookStart;
  onSuggested: (book: BookDTO) => void;
  onCancel: () => void;
}) => {
  const { mutate, isPending, error } = useCreateManualBookSuggestion();
  const [values, setValues] = useState<Record<FieldName, string>>({
    title: start.title,
    author: "",
    yearPublished: "",
    pageCount: "",
    goodreadsUrl: start.goodreadsUrl,
    synopsis: "",
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FieldName, string[]>>
  >({});

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const orNull = (value: string) => (value.trim() === "" ? null : value);
    // A typo like "20l1" becomes NaN, which the schema rejects.
    const orNumber = (value: string) =>
      value.trim() === "" ? null : Number(value);
    const result = ManualBookSuggestionSchema.safeParse({
      title: values.title,
      author: values.author,
      yearPublished: orNumber(values.yearPublished),
      pageCount: orNumber(values.pageCount),
      goodreadsUrl: orNull(values.goodreadsUrl),
      synopsis: orNull(values.synopsis),
    });
    if (!result.success) {
      setFieldErrors(z.flattenError(result.error).fieldErrors);
      return;
    }
    setFieldErrors({});
    mutate(result.data, { onSuccess: onSuggested });
  };

  // The props every input shares.
  const bind = (name: FieldName) => ({
    id: `manual-${name}`,
    value: values[name],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [name]: e.target.value })),
    error: fieldErrors[name]?.[0],
  });

  const synopsis = bind("synopsis");

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="card manual-book"
      aria-labelledby="manual-book-title"
    >
      <div className="manual-book-head">
        <h2 id="manual-book-title">Add it yourself</h2>
        <p className="muted">
          Just the title and author will do. You can add the rest later.
        </p>
      </div>
      <Field {...bind("title")} label="Title" />
      <Field {...bind("author")} label="Author" />
      <div className="manual-book-pair">
        <Field
          {...bind("yearPublished")}
          label="Year published"
          inputMode="numeric"
        />
        <Field {...bind("pageCount")} label="Pages" inputMode="numeric" />
      </div>
      <Field {...bind("goodreadsUrl")} label="Goodreads link" type="url" />
      <div>
        <label htmlFor={synopsis.id}>What it's about</label>
        <textarea
          id={synopsis.id}
          rows={4}
          value={synopsis.value}
          onChange={synopsis.onChange}
          aria-invalid={!!synopsis.error}
          aria-describedby={synopsis.error ? `${synopsis.id}-error` : undefined}
        />
        {synopsis.error && (
          <p id={`${synopsis.id}-error`} role="alert">
            {synopsis.error}
          </p>
        )}
      </div>

      {error && <p role="alert">{error.message}</p>}
      <div className="manual-book-actions">
        <button type="submit" disabled={isPending}>
          {isPending ? "Suggesting..." : "Suggest this book"}
        </button>
        <button type="button" className="button-quiet" onClick={onCancel}>
          Back to search
        </button>
      </div>
    </form>
  );
};

export default ManualBookForm;
