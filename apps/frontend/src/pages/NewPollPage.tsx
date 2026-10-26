import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import * as z from "zod";
import {
  CreatePollSchema,
  MIN_POLL_BOOKS,
  type SuggestedBookDTO,
} from "shared";
import { useBookSuggestions, useCreatePoll } from "../hooks";
import { toLocalInput } from "../lib/datetime-local";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_VOTES = 2;

// Rendered once the selected books are known, so the defaults can depend on
// how many there are.
const PollForm = ({ books }: { books: SuggestedBookDTO[] }) => {
  const navigate = useNavigate();
  const { mutate, isPending, error } = useCreatePoll();
  const [closesAt, setClosesAt] = useState(() =>
    toLocalInput(new Date(Date.now() + WEEK_MS)),
  );
  // Members vote for fewer books than are on the ballot (see the schema).
  const maxVotes = books.length - 1;
  const [votesPerMember, setVotesPerMember] = useState(
    String(Math.min(DEFAULT_VOTES, maxVotes)),
  );
  const [theme, setTheme] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = {
      bookIds: books.map((b) => b.id),
      // datetime-local has no zone, so this is the admin's local time.
      closesAt: new Date(closesAt),
      votesPerMember: Number(votesPerMember),
      theme: theme.trim() || null,
    };
    // Same check as the API, for a specific message instead of "Invalid
    // request". safeEncode, because closesAt is already a Date.
    const result = z.safeEncode(CreatePollSchema, values);
    if (!result.success) {
      setInvalid(result.error.issues[0].message);
      return;
    }
    setInvalid(null);
    mutate(values, { onSuccess: (poll) => navigate(`/polls/${poll.id}`) });
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>On the ballot</h2>
      <ul aria-label="Books on the ballot">
        {books.map((book) => (
          <li key={book.id}>
            <strong>{book.title}</strong> by {book.author}
          </li>
        ))}
      </ul>
      <p>
        <Link to="/books/suggestions">Change the selection</Link>
      </p>
      <div>
        <label htmlFor="closes-at">Voting closes</label>
        <input
          id="closes-at"
          type="datetime-local"
          required
          min={toLocalInput(new Date())}
          value={closesAt}
          onChange={(e) => setClosesAt(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="votes-per-member">Votes per member</label>
        <input
          id="votes-per-member"
          type="number"
          required
          min={1}
          max={maxVotes}
          step={1}
          value={votesPerMember}
          onChange={(e) => setVotesPerMember(e.target.value)}
          aria-describedby="votes-per-member-hint"
        />
        <p id="votes-per-member-hint">
          Usually one per meeting you're choosing books for.
        </p>
      </div>
      <div>
        <label htmlFor="theme">Theme (optional)</label>
        <input
          id="theme"
          value={theme}
          maxLength={100}
          onChange={(e) => setTheme(e.target.value)}
        />
      </div>
      {invalid && <p role="alert">{invalid}</p>}
      {error && <p role="alert">{error.message}</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create poll"}
      </button>
    </form>
  );
};

// Admin-only (see the route in app.tsx). Reached from the suggestions page
// with ?books=id1,id2,… so a refresh keeps the selection.
const NewPollPage = () => {
  const [searchParams] = useSearchParams();
  const suggestions = useBookSuggestions();

  const ids = (searchParams.get("books") ?? "").split(",").filter(Boolean);
  // Keeps the order they were picked in. Ids that are no longer suggestions
  // (assigned to a meeting since, or made up) are dropped.
  const books = ids.flatMap((id) => {
    const book = suggestions.data?.find((b) => b.id === id);
    return book ? [book] : [];
  });

  return (
    <div>
      <h1>New poll</h1>
      {suggestions.isPending && <p>Loading...</p>}
      {suggestions.error && <p role="alert">{suggestions.error.message}</p>}
      {suggestions.data &&
        (books.length < MIN_POLL_BOOKS ? (
          <p>
            Pick at least {MIN_POLL_BOOKS} books from the{" "}
            <Link to="/books/suggestions">suggestions list</Link> first.
          </p>
        ) : (
          <PollForm books={books} />
        ))}
    </div>
  );
};

export default NewPollPage;
