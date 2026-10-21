import { type KeyboardEvent, useState } from "react";
import * as z from "zod";
import { type CreateVenueDTO, CreateVenueSchema, type VenueDTO } from "shared";
import { useCreateVenue } from "../hooks";

const FIELDS: { name: keyof CreateVenueDTO; label: string; autoComplete: string }[] = [
  { name: "name", label: "Venue name", autoComplete: "off" },
  { name: "streetAddress", label: "Street address", autoComplete: "address-line1" },
  { name: "city", label: "City", autoComplete: "address-level2" },
  { name: "state", label: "State", autoComplete: "address-level1" },
  { name: "zip", label: "ZIP code", autoComplete: "postal-code" },
];

const EMPTY: CreateVenueDTO = {
  name: "",
  streetAddress: "",
  city: "",
  state: "",
  zip: "",
};

type FieldErrors = Partial<Record<keyof CreateVenueDTO, string[]>>;

// Sits inside another form (the event form), and forms can't nest, so this
// is a fieldset whose Save button saves the venue by itself.
const NewVenueFields = ({
  onSaved,
  onCancel,
}: {
  onSaved: (venue: VenueDTO) => void;
  onCancel: () => void;
}) => {
  const [venue, setVenue] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const { mutate, isPending, error } = useCreateVenue();

  const save = () => {
    const result = CreateVenueSchema.safeParse(venue);
    if (!result.success) {
      setFieldErrors(z.flattenError(result.error).fieldErrors);
      return;
    }
    setFieldErrors({});
    mutate(result.data, { onSuccess: onSaved });
  };

  // Enter would otherwise submit the event form around this.
  const handleKeyDown = (e: KeyboardEvent<HTMLFieldSetElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
  };

  return (
    <fieldset onKeyDown={handleKeyDown}>
      <legend>New venue</legend>
      {FIELDS.map(({ name, label, autoComplete }) => {
        const id = `venue-${name}`;
        const message = fieldErrors[name]?.[0];
        return (
          <div key={name}>
            <label htmlFor={id}>{label}</label>
            <input
              id={id}
              autoComplete={autoComplete}
              value={venue[name]}
              onChange={(e) => setVenue({ ...venue, [name]: e.target.value })}
              aria-invalid={!!message}
              aria-describedby={message ? `${id}-error` : undefined}
            />
            {message && <p id={`${id}-error`}>{message}</p>}
          </div>
        );
      })}
      {error && <p role="alert">{error.message}</p>}
      <button type="button" onClick={save} disabled={isPending}>
        {isPending ? "Saving..." : "Save venue"}
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </fieldset>
  );
};

export default NewVenueFields;
