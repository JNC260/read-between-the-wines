import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as z from "zod";
import { MAX_POLL_BOOKS, type PollDTO, UpdatePollSchema } from "shared";
import { useBookSuggestions, usePoll, useUpdatePoll } from "../hooks";
import { toLocalInput } from "../lib/datetime-local";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Rendered once the poll has loaded, since it only seeds the inputs. On a
// closed poll, saving reopens it until the new closing time.
const PollEditForm = ({ poll }: { poll: PollDTO }) => {
  const navigate = useNavigate();
  const suggestions = useBookSuggestions();
  const { mutate, isPending, error } = useUpdatePoll();
  const [theme, setTheme] = useState(poll.theme ?? "");
  const [closesAt, setClosesAt] = useState(() =>
    toLocalInput(poll.isOpen ? poll.closesAt : new Date(Date.now() + WEEK_MS)),
  );
  const [votesPerMember, setVotesPerMember] = useState(String(poll.votesPerMember));
  const [adding, setAdding] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);

  const onBallot = new Set(poll.books.map((b) => b.id));
  const addable = suggestions.data?.filter((b) => !onBallot.has(b.id)) ?? [];
  // There can be a hundred-odd suggestions, so they're searched, not listed.
  // Ticked books stay in view whatever the search.
  const q = search.trim().toLowerCase();
  const shown = q
    ? addable.filter(
        (b) =>
          adding.includes(b.id) ||
          `${b.title} ${b.author}`.toLowerCase().includes(q),
      )
    : addable.filter((b) => adding.includes(b.id));
  const room = MAX_POLL_BOOKS - poll.books.length - adding.length;

  const toggle = (id: string) =>
    setAdding((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id],
    );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = {
      theme: theme.trim() || null,
      // datetime-local has no zone, so this is the admin's local time.
      closesAt: new Date(closesAt),
      votesPerMember: Number(votesPerMember),
      addBookIds: adding,
    };
    // safeEncode, because closesAt is already a Date.
    const result = z.safeEncode(UpdatePollSchema, values);
    if (!result.success) {
      setInvalid(result.error.issues[0].message);
      return;
    }
    setInvalid(null);
    mutate(
      { id: poll.id, ...values },
      { onSuccess: () => navigate(`/polls/${poll.id}`) },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="poll-edit">
      <div>
        <label htmlFor="theme">Theme (optional)</label>
        <input
          id="theme"
          value={theme}
          maxLength={100}
          onChange={(e) => setTheme(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="closes-at">Voting closes</label>
        <input
          id="closes-at"
          type="datetime-local"
          required
          min={toLocalInput(new Date())}
          value={closesAt}
          onChange={(e) => setClosesAt(e.target.value)}
          aria-describedby="closes-at-hint"
        />
        <p id="closes-at-hint" className="muted">
          {poll.isOpen
            ? "Move it later to keep voting open longer."
            : "Voting opens again until this time."}
        </p>
      </div>
      <div>
        <label htmlFor="votes-per-member">Votes per member</label>
        <input
          id="votes-per-member"
          type="number"
          required
          min={1}
          step={1}
          value={votesPerMember}
          onChange={(e) => setVotesPerMember(e.target.value)}
          aria-describedby="votes-per-member-hint"
        />
        <p id="votes-per-member-hint" className="muted">
          Can't go below what a member has already used.
        </p>
      </div>

      <fieldset>
        <legend>On the ballot</legend>
        <ul className="poll-edit-books">
          {poll.books.map((book) => (
            <li key={book.id}>
              <strong>{book.title}</strong> by {book.author}
            </li>
          ))}
        </ul>
        <p className="muted">
          Books can be added but not taken off, so nobody loses a vote.
        </p>
      </fieldset>

      <fieldset>
        <legend>Add books</legend>
        {suggestions.isPending && <p>Loading...</p>}
        {suggestions.data && addable.length === 0 && (
          <p className="muted">Every suggestion is already on the ballot.</p>
        )}
        {addable.length > 0 && (
          <>
            <p className="muted">
              Up to {MAX_POLL_BOOKS} books in all.{" "}
              {room > 0 ? `Room for ${room} more.` : "The ballot is full."}
            </p>
            <label htmlFor="add-search" className="visually-hidden">
              Search suggestions
            </label>
            <input
              id="add-search"
              type="search"
              placeholder="Search by title or author"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {q && shown.length === 0 && (
              <p className="muted">No suggestions match that.</p>
            )}
            <ul className="poll-edit-books">
              {shown.map((book) => {
                const checked = adding.includes(book.id);
                return (
                  <li key={book.id}>
                    <label className="poll-edit-add">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && room <= 0}
                        onChange={() => toggle(book.id)}
                      />
                      <span>
                        <strong>{book.title}</strong> by {book.author}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </fieldset>

      {invalid && <p role="alert">{invalid}</p>}
      {error && <p role="alert">{error.message}</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : poll.isOpen ? "Save changes" : "Reopen voting"}
      </button>
    </form>
  );
};

// Admin-only (see the route in app.tsx).
const EditPollPage = () => {
  const { id = "" } = useParams();
  const { data: poll, isPending, error } = usePoll(id);

  if (isPending) {
    return <p>Loading...</p>;
  }
  if (error) {
    return <p role="alert">{error.message}</p>;
  }

  return (
    <div className="poll-edit-page">
      <p className="back-link">
        <Link to={`/polls/${poll.id}`}>← Back to the poll</Link>
      </p>
      <h1>{poll.isOpen ? "Edit poll" : "Reopen voting"}</h1>
      <PollEditForm key={poll.id} poll={poll} />
    </div>
  );
};

export default EditPollPage;
