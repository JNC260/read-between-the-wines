import { type RsvpDTO, type RsvpStatus } from "shared";
import { useMeetingRsvps, useSetRsvp } from "../hooks";
import { initials } from "../lib/initials";

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

const MAX_FACES = 4;

const countLine = (rsvps: RsvpDTO[]) => {
  const going = rsvps.filter((r) => r.status === "YES").length;
  const maybe = rsvps.filter((r) => r.status === "MAYBE").length;
  if (going === 0 && maybe === 0) {
    return "No one has answered yet";
  }
  return [`${going} going`, maybe > 0 && `${maybe} maybe`]
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
            <span key={r.member.id} className="face">
              {initials(r.member)}
            </span>
          ))}
        </span>
      )}
      <span>{countLine(data.rsvps)}</span>
    </div>
  );
};
