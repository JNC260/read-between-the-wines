import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { type OpenInviteDTO, type UserDTO } from "shared";
import Avatar from "../components/Avatar";
import {
  useAccounts,
  useBanUser,
  useMakeAdmin,
  useOpenInvites,
  useRemoveAdmin,
  useRevokeInvite,
  useUnbanUser,
} from "../hooks";
import { authClient } from "../lib/auth-client";

const shortDate = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

const fullName = (u: { firstName: string; lastName: string }) =>
  `${u.firstName} ${u.lastName}`;

// An action that asks once first, in the member's row: banning, and making
// or removing an admin. useAction is the mutation hook for it.
const ConfirmButton = ({
  member,
  label,
  verb,
  question,
  keepLabel,
  useAction,
}: {
  member: UserDTO;
  label: string;
  // "Ban" becomes the button's accessible name "Ban Ada Lovelace".
  verb: string;
  question: string;
  keepLabel: string;
  useAction: () => { mutate: (id: string) => void; isPending: boolean; error: Error | null };
}) => {
  const { mutate, isPending, error } = useAction();
  const [confirming, setConfirming] = useState(false);
  const name = fullName(member);

  if (!confirming) {
    return (
      <button
        type="button"
        className="button-quiet"
        aria-label={`${verb} ${name}`}
        onClick={() => setConfirming(true)}
      >
        {label}
      </button>
    );
  }
  return (
    <div className="manage-confirm" role="group" aria-label={`${verb} ${name}`}>
      <p>{question}</p>
      {error && <p role="alert">{error.message}</p>}
      <div className="manage-confirm-buttons">
        <button
          type="button"
          className="button-primary"
          disabled={isPending}
          onClick={() => mutate(member.id)}
        >
          {isPending ? "Saving..." : label}
        </button>
        <button type="button" className="button-quiet" onClick={() => setConfirming(false)}>
          {keepLabel}
        </button>
      </div>
    </div>
  );
};

const BanButton = ({ member }: { member: UserDTO }) => (
  <ConfirmButton
    member={member}
    label="Ban"
    verb="Ban"
    question={`Ban ${fullName(member)}? They're signed out right away and can't sign in again until the ban is lifted. Their suggestions, ratings and RSVPs stay.`}
    keepLabel="Keep them"
    useAction={useBanUser}
  />
);

const MakeAdminButton = ({ member }: { member: UserDTO }) => (
  <ConfirmButton
    member={member}
    label="Make admin"
    verb="Make admin:"
    question={`Make ${fullName(member)} an admin? They'll be able to create polls and meetings, cancel meetings, ban members and make other admins.`}
    keepLabel="Not now"
    useAction={useMakeAdmin}
  />
);

const RemoveAdminButton = ({ member }: { member: UserDTO }) => (
  <ConfirmButton
    member={member}
    label="Remove admin"
    verb="Remove admin:"
    question={`Remove ${fullName(member)} as an admin? They'll stay a member.`}
    keepLabel="Keep them"
    useAction={useRemoveAdmin}
  />
);

const UnbanButton = ({ member }: { member: UserDTO }) => {
  const { mutate, isPending, error } = useUnbanUser();
  return (
    <>
      <button
        type="button"
        className="button-quiet"
        aria-label={`Lift the ban on ${fullName(member)}`}
        disabled={isPending}
        onClick={() => mutate(member.id)}
      >
        {isPending ? "Lifting..." : "Lift ban"}
      </button>
      {error && <p role="alert">{error.message}</p>}
    </>
  );
};

const AccountRow = ({
  member,
  isMe,
  children,
}: {
  member: UserDTO;
  isMe: boolean;
  children?: ReactNode;
}) => (
  <li className="manage-row">
    <Avatar member={member} size="small" />
    <div className="manage-row-text">
      <strong>
        {fullName(member)}
        {isMe && " (you)"}
      </strong>
      <span className="muted">{member.email}</span>
      {member.status === "INACTIVE" && <span className="badge">Inactive</span>}
    </div>
    <div className="manage-row-actions">{children}</div>
  </li>
);

const InviteRow = ({ invite }: { invite: OpenInviteDTO }) => {
  const { mutate, isPending, error } = useRevokeInvite();
  return (
    <li className="manage-row">
      <div className="manage-row-text">
        <strong>
          {invite.invitedBy ? `From ${fullName(invite.invitedBy)}` : "From the setup script"}
        </strong>
        <span className="muted">
          Made {shortDate.format(invite.createdAt)} · expires{" "}
          {shortDate.format(invite.expiresAt)}
        </span>
      </div>
      <div className="manage-row-actions">
        <button
          type="button"
          className="button-quiet"
          aria-label={`Revoke the invite made ${shortDate.format(invite.createdAt)}`}
          disabled={isPending}
          onClick={() => mutate(invite.id)}
        >
          {isPending ? "Revoking..." : "Revoke"}
        </button>
        {error && <p role="alert">{error.message}</p>}
      </div>
    </li>
  );
};

// Admin-only (see the route in app.tsx).
const ManageMembersPage = () => {
  const { data: session } = authClient.useSession();
  const accounts = useAccounts();
  const invites = useOpenInvites();

  const members = accounts.data?.filter((u) => u.status !== "BANNED") ?? [];
  const banned = accounts.data?.filter((u) => u.status === "BANNED") ?? [];

  return (
    <div className="manage-page">
      <p className="back-link">
        <Link to="/members">← Members</Link>
      </p>
      <h1>Manage members</h1>

      <section aria-labelledby="accounts-title">
        <h2 id="accounts-title">Members</h2>
        {accounts.isPending && <p>Loading...</p>}
        {accounts.error && <p role="alert">{accounts.error.message}</p>}
        {accounts.data && (
          <ul className="manage-list">
            {members.map((member) => {
              const isMe = member.id === session?.user.id;
              return (
                <AccountRow key={member.id} member={member} isMe={isMe}>
                  {member.isAdmin && <span className="badge badge-mine">Admin</span>}
                  {/* Nobody changes their own role, and admins can't be
                      banned (the API checks both). Only active members can
                      become admins. */}
                  {!isMe && member.isAdmin && <RemoveAdminButton member={member} />}
                  {!isMe && !member.isAdmin && member.status === "ACTIVE" && (
                    <MakeAdminButton member={member} />
                  )}
                  {!isMe && !member.isAdmin && <BanButton member={member} />}
                </AccountRow>
              );
            })}
          </ul>
        )}
      </section>

      {banned.length > 0 && (
        <section aria-labelledby="banned-title">
          <h2 id="banned-title">Banned</h2>
          <ul className="manage-list">
            {banned.map((member) => (
              <AccountRow key={member.id} member={member} isMe={false}>
                <UnbanButton member={member} />
              </AccountRow>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="invites-title">
        <div className="manage-section-head">
          <h2 id="invites-title">Unused invite links</h2>
          <Link to="/invite-member" className="button-link button-quiet">
            New invite link
          </Link>
        </div>
        <p className="muted">
          Only a fingerprint of each link is kept, so a link can't be shown again.
          Revoke one that went to the wrong person, and make a new one if needed.
        </p>
        {invites.isPending && <p>Loading...</p>}
        {invites.error && <p role="alert">{invites.error.message}</p>}
        {invites.data?.length === 0 && <p>No unused links.</p>}
        {invites.data && invites.data.length > 0 && (
          <ul className="manage-list">
            {invites.data.map((invite) => (
              <InviteRow key={invite.id} invite={invite} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default ManageMembersPage;
