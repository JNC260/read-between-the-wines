import { type FormEvent, useState } from "react";
import {
  MAX_GUESTS,
  type RsvpDTO,
  type RsvpStatus,
  type SetRsvpDTO,
  SetRsvpSchema,
} from "shared";
import * as z from "zod";
import { useMeetingRsvps, useSetRsvp } from "../hooks";
import { authClient } from "../lib/auth-client";
import Avatar from "./Avatar";
import Field from "./Field";

const CHOICES: { status: RsvpStatus; label: string }[] = [
  { status: "YES", label: "I'm in" },
  { status: "MAYBE", label: "Maybe" },
  { status: "NO", label: "Can't go" },
];

// The three answers. While a new answer saves, it shows as picked so the
// tap feels instant.
export const RsvpButtons = ({ meetingId }: { meetingId: string }) => {
  const { data } = useMeetingRsvps(meetingId);
  const { mutate, isPending, variables, error } = useSetRsvp();
  const shown = isPending ? variables.status : data?.myStatus;

  return (
    <div className="rsvp">
      <div className="rsvp-buttons" role="group" aria-label="Are you coming?">
        {CHOICES.map(({ status, label }) => (
          <button
            key={status}
            type="button"
            aria-pressed={shown === status}
            disabled={isPending}
            onClick={() => mutate({ meetingId, status })}
          >
            {label}
            {shown === status && status === "YES" && " ✓"}
          </button>
        ))}
      </div>
      {error && <p role="alert">{error.message}</p>}
    </div>
  );
};

// What they're bringing and who's coming with them. Shown once they've said
// yes or maybe; the status buttons above save the answer on their own, so
// this is for the details. Pass `mine` to fill in what they said before.
const RsvpDetailsForm = ({
  meetingId,
  status,
  mine,
}: {
  meetingId: string;
  status: RsvpStatus;
  mine: RsvpDTO | undefined;
}) => {
  const [dish, setDish] = useState(mine?.dish ?? "");
  const [guests, setGuests] = useState(String(mine?.guestCount ?? 0));
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof SetRsvpDTO, string[]>>
  >({});
  const { mutate, isPending, isSuccess, error, reset } = useSetRsvp();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // An empty guests box means none; a typo like "2.5" becomes a message.
    const result = SetRsvpSchema.safeParse({
      status,
      dish: dish.trim() || null,
      guestCount: guests.trim() === "" ? 0 : Number(guests),
    });
    if (!result.success) {
      setFieldErrors(z.flattenError(result.error).fieldErrors);
      return;
    }
    setFieldErrors({});
    mutate({ meetingId, ...result.data });
  };

  // Editing again hides the "Saved" note until the next save.
  const edit = (set: (value: string) => void, value: string) => {
    reset();
    set(value);
  };

  return (
    <form className="rsvp-details" onSubmit={handleSubmit} noValidate>
      <Field
        id="rsvp-dish"
        label="Bringing food? (optional)"
        placeholder="Lemon bars, a cheese plate…"
        value={dish}
        onChange={(e) => edit(setDish, e.target.value)}
        error={fieldErrors.dish?.[0]}
      />
      <Field
        id="rsvp-guests"
        label="Guests"
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_GUESTS}
        step={1}
        value={guests}
        onChange={(e) => edit(setGuests, e.target.value)}
        error={fieldErrors.guestCount?.[0]}
      />
      <div className="rsvp-details-actions">
        <button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save"}
        </button>
        {isSuccess && <span role="status">Saved</span>}
      </div>
      {error && <p role="alert">{error.message}</p>}
    </form>
  );
};

// Remounts per answer (key) so the fields always start from what was saved.
export const RsvpDetails = ({ meetingId }: { meetingId: string }) => {
  const { data: session } = authClient.useSession();
  const { data } = useMeetingRsvps(meetingId);
  const status = data?.myStatus;
  if (!session || (status !== "YES" && status !== "MAYBE")) {
    return null;
  }
  const mine = data?.rsvps.find((r) => r.member.id === session.user.id);
  return (
    <RsvpDetailsForm
      key={status}
      meetingId={meetingId}
      status={status}
      mine={mine}
    />
  );
};

export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

const MAX_FACES = 4;

const countLine = (rsvps: RsvpDTO[]) => {
  const yes = rsvps.filter((r) => r.status === "YES");
  const going = yes.length;
  const guests = yes.reduce((sum, r) => sum + r.guestCount, 0);
  const maybe = rsvps.filter((r) => r.status === "MAYBE").length;
  if (going === 0 && maybe === 0) {
    return "No one has answered yet";
  }
  return [
    `${going} going`,
    guests > 0 && `+${plural(guests, "guest")}`,
    maybe > 0 && `${maybe} maybe`,
  ]
    .filter(Boolean)
    .join(" · ");
};

// A few initials and the head count, e.g. "8 going · 2 maybe".
export const WhoIsGoing = ({ meetingId }: { meetingId: string }) => {
  const { data } = useMeetingRsvps(meetingId);
  if (!data) {
    return null;
  }
  const going = data.rsvps.filter((r) => r.status === "YES");
  return (
    <div className="going">
      {going.length > 0 && (
        <span className="faces" aria-hidden="true">
          {going.slice(0, MAX_FACES).map((r) => (
            <Avatar key={r.member.id} member={r.member} size="small" />
          ))}
        </span>
      )}
      <span>{countLine(data.rsvps)}</span>
    </div>
  );
};
