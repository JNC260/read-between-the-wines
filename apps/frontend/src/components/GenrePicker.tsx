import { type Genre, GENRES, MAX_GENRES } from "shared";

// The club's genres as chips to tick, up to MAX_GENRES. Once that many are
// on, the rest wait until one is turned off.
const GenrePicker = ({
  value,
  onChange,
  error,
}: {
  value: Genre[];
  onChange: (genres: Genre[]) => void;
  error?: string;
}) => {
  const full = value.length >= MAX_GENRES;
  const toggle = (genre: Genre) =>
    onChange(
      value.includes(genre)
        ? value.filter((g) => g !== genre)
        : [...value, genre],
    );

  return (
    <fieldset className="genre-picker" aria-describedby="genres-hint">
      <legend>Genres</legend>
      <p id="genres-hint" className="muted">
        Pick up to {MAX_GENRES}. New books are tagged for you, so this is for
        fixing a tag that's off.
      </p>
      <div className="genre-chips">
        {GENRES.map((genre) => {
          const on = value.includes(genre);
          return (
            <button
              key={genre}
              type="button"
              className="chip"
              aria-pressed={on}
              disabled={full && !on}
              onClick={() => toggle(genre)}
            >
              {genre}
            </button>
          );
        })}
      </div>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
};

export default GenrePicker;
