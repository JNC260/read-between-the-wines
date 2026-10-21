import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as z from "zod";
import { CreateMeetingSchema } from "shared";
import { useCreateMeeting, useVenues } from "../hooks";

// Admin-only (see the route in app.tsx). Events are meetings in the API.
const NewEventPage = () => {
  const navigate = useNavigate();
  const venues = useVenues();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [venueId, setVenueId] = useState("");
  const [description, setDescription] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);
  const { mutate, isPending, error } = useCreateMeeting();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // datetime-local values have no time zone, so new Date() reads them as
    // the admin's local time, which is what they meant.
    const event = {
      title,
      start: new Date(start),
      end: new Date(end),
      venueId: venueId || null,
      description: description || null,
    };
    // Check here too: the API only says "Invalid request", and this gives
    // the real reason, like the end being before the start. safeEncode, not
    // safeParse, because the dates are already Date objects.
    const result = z.safeEncode(CreateMeetingSchema, event);
    if (!result.success) {
      setInvalid(result.error.issues[0].message);
      return;
    }
    setInvalid(null);
    mutate(event, {
      onSuccess: () => navigate("/events"),
    });
  };

  return (
    <div>
      <h1>New event</h1>
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
          </select>
          {venues.error && <p role="alert">{venues.error.message}</p>}
        </div>
        <div>
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {invalid && <p role="alert">{invalid}</p>}
        {error && <p role="alert">{error.message}</p>}
        <button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create event"}
        </button>
      </form>
    </div>
  );
};

export default NewEventPage;
