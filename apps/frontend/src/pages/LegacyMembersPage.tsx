import { useState } from "react";
import { type PlaceholderDTO, type UserDTO } from "shared";
import { useMembers, useMergePlaceholder, usePlaceholders } from "../hooks";

const fullName = (p: { firstName: string; lastName: string }) =>
  `${p.firstName} ${p.lastName}`;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Most are picked for the admin: a member with the same full name is almost
// certainly them. New members with an exact match are merged automatically
// when they verify, so the ones left here are usually nicknames or a changed
// last name.
const sameName = (p: PlaceholderDTO, members: UserDTO[]) =>
  members.find(
    (m) => fullName(m).toLowerCase() === fullName(p).toLowerCase(),
  )?.id ?? "";

const PlaceholderRow = ({
  placeholder,
  members,
  onMerged,
}: {
  placeholder: PlaceholderDTO;
  members: UserDTO[];
  onMerged: (message: string) => void;
}) => {
  const [memberId, setMemberId] = useState(() => sameName(placeholder, members));
  const [confirming, setConfirming] = useState(false);
  const { mutate, isPending, error } = useMergePlaceholder();
  const member = members.find((m) => m.id === memberId);
  const selectId = `merge-${placeholder.id}`;

  const merge = () =>
    mutate(
      { placeholderId: placeholder.id, memberId },
      {
        onSuccess: (moved) =>
          onMerged(
            `Gave ${fullName(placeholder)}'s ${plural(moved.suggestions, "suggestion")} to ${member ? fullName(member) : "the member"}.`,
          ),
      },
    );

  return (
    <li className="card">
      <h2>{fullName(placeholder)}</h2>
      <p className="muted">
        {plural(placeholder.suggestionCount, "legacy suggestion")}
      </p>
      <label htmlFor={selectId}>This is</label>
      <select
        id={selectId}
        value={memberId}
        onChange={(e) => {
          setMemberId(e.target.value);
          setConfirming(false);
        }}
      >
        <option value="">Pick a member…</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {fullName(m)}
          </option>
        ))}
      </select>
      {error && <p role="alert">{error.message}</p>}
      {confirming && member ? (
        <>
          <p>
            {fullName(placeholder)}'s suggestions, ratings, votes and RSVPs go
            to {fullName(member)}, and the legacy entry is deleted. This can't
            be undone.
          </p>
          <button
            type="button"
            className="button-primary"
            disabled={isPending}
            onClick={merge}
          >
            {isPending ? "Merging..." : `Merge into ${fullName(member)}`}
          </button>
          <button type="button" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={!member}
          onClick={() => setConfirming(true)}
        >
          Merge…
        </button>
      )}
    </li>
  );
};

// Admin-only. People from the old Google Form who haven't been matched to
// an account yet.
const LegacyMembersPage = () => {
  const placeholders = usePlaceholders();
  const members = useMembers();
  const [message, setMessage] = useState<string | null>(null);

  if (placeholders.isPending || members.isPending) {
    return <p>Loading…</p>;
  }
  if (placeholders.isError || members.isError) {
    return (
      <p role="alert">
        {(placeholders.error ?? members.error)?.message}
      </p>
    );
  }

  return (
    <div>
      <h1>Legacy members</h1>
      <p>
        People from the old suggestion form who haven't been matched to an
        account. When one joins, pick their account here to give them their
        old suggestions.
      </p>
      {message && <p role="status">{message}</p>}
      {placeholders.data.length === 0 ? (
        <p>Everyone has been matched.</p>
      ) : (
        <ul>
          {placeholders.data.map((p) => (
            <PlaceholderRow
              key={p.id}
              placeholder={p}
              members={members.data}
              onMerged={setMessage}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

export default LegacyMembersPage;
