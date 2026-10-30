import { type FormEvent, useState } from "react";
import * as z from "zod";
import { type CreateMeetingDTO, CreateMeetingSchema, type MeetingDTO } from "shared";
import NewVenueFields from "./NewVenueFields";
import { useBookSuggestions, useVenues } from "../hooks";
import { toLocalInput } from "../lib/datetime-local";

// The dropdown value that opens the new venue fields. Never a real id,
// since those are UUIDs.
const NEW_VENUE = "new";

// What the form sends: every field, so an edit can also clear the venue,
// book, description or craft (null) rather than leave them as they were.
export type MeetingValues = Required<
  Pick<
    CreateMeetingDTO,
    "title" | "start" | "end" | "venueId" | "bookId" | "description" | "craft"
  >
>;

// Shared by the new and edit meeting pages. Pass `meeting` to pre-fill it; it's
// only read on the first render, so render the form once the meeting loads.
const MeetingForm = ({
  meeting,
  onSubmit,
  isPending,
  error,
  submitLabel,
  pendingLabel,
}: {
  meeting?: MeetingDTO;
  onSubmit: (values: MeetingValues) => void;
  isPending: boolean;
  error: Error | null;
  submitLabel: string;
  pendingLabel: string;
}) => {
  const venues = useVenues();
  const suggestions = useBookSuggestions();
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [start, setStart] = useState(meeting ? toLocalInput(meeting.start) : "");
  const [end, setEnd] = useState(meeting ? toLocalInput(meeting.end) : "");
  const [venueId, setVenueId] = useState(meeting?.venueId ?? "");
  const [bookId, setBookId] = useState(meeting?.bookId ?? "");
  const [description, setDescription] = useState(meeting?.description ?? "");
  const [craft, setCraft] = useState(meeting?.craft ?? "");
  const [invalid, setInvalid] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (venueId === NEW_VENUE) {
      setInvalid("Save or cancel the new venue first.");
      return;
    }
    // datetime-local values have no time zone, so new Date() reads them as
    // the admin's local time, which is what they meant.
    const values = {
      title,
      start: new Date(start),
      end: new Date(end),
      venueId: venueId || null,
      bookId: bookId || null,
      description: description || null,
      craft: craft || null,
    };
    // Check here too: the API only says "Invalid request", and this gives
    // the real reason, like the end being before the start. safeEncode, not
    // safeParse, because the dates are already Date objects.
    const result = z.safeEncode(CreateMeetingSchema, values);
    if (!result.success) {
      setInvalid(result.error.issues[0].message);
      return;
    }
    setInvalid(null);
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="start">Starts</label>
        <input
          id="start"
          type="datetime-local"
          required
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="end">Ends</label>
        <input
          id="end"
          type="datetime-local"
          required
          min={start}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="venue">Venue</label>
        <select
          id="venue"
          value={venueId}
          onChange={(e) => setVenueId(e.target.value)}
        >
          <option value="">Not decided yet</option>
          {venues.data?.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
            </option>
          ))}
          <option value={NEW_VENUE}>Add a new venue…</option>
        </select>
        {venues.error && <p role="alert">{venues.error.message}</p>}
      </div>
      {venueId === NEW_VENUE && (
        <NewVenueFields
          onSaved={(venue) => setVenueId(venue.id)}
          onCancel={() => setVenueId("")}
        />
      )}
      <div>
        <label htmlFor="book">Book</label>
        {/* Suggestions leave out books already on a meeting, so this
            meeting's own book is added back as its own option. */}
        <select
          id="book"
          value={bookId}
          onChange={(e) => setBookId(e.target.value)}
        >
          <option value="">Not decided yet</option>
          {meeting?.book && (
            <option value={meeting.book.id}>
              {meeting.book.title} by {meeting.book.author}
            </option>
          )}
          {[...(suggestions.data ?? [])]
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((book) => (
              <option key={book.id} value={book.id}>
                {book.title} by {book.author}
              </option>
            ))}
        </select>
        {suggestions.error && <p role="alert">{suggestions.error.message}</p>}
      </div>
      <div>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="craft">Craft</label>
        <p className="muted" id="craft-hint">
          Optional. What you're making, and anything members should bring for
          it.
        </p>
        <textarea
          id="craft"
          aria-describedby="craft-hint"
          value={craft}
          onChange={(e) => setCraft(e.target.value)}
        />
      </div>
      {invalid && <p role="alert">{invalid}</p>}
      {error && <p role="alert">{error.message}</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
};

export default MeetingForm;
