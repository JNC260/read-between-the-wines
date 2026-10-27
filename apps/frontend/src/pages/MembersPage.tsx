import { Link } from "react-router-dom";
import { formatPhone, type HandleSite, handleUrl, type UserDTO } from "shared";
import { useMembers } from "../hooks";
import { authClient } from "../lib/auth-client";

const HANDLES: { site: HandleSite; label: string }[] = [
  { site: "instagram", label: "Instagram" },
  { site: "tiktok", label: "TikTok" },
  { site: "x", label: "X" },
  { site: "venmo", label: "Venmo" },
];

const initials = (member: UserDTO) =>
  `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toUpperCase();

const ExternalLink = ({ href, children }: { href: string; children: string }) => (
  <a href={href} target="_blank" rel="noreferrer">
    {children}
  </a>
);

// Only what the member chose to add; empty fields don't show at all.
const ContactList = ({ member }: { member: UserDTO }) => (
  <ul aria-label={`How to reach ${member.firstName}`}>
    <li>
      Email: <a href={`mailto:${member.email}`}>{member.email}</a>
    </li>
    {member.phone && (
      <li>
        Phone: <a href={`tel:${member.phone}`}>{formatPhone(member.phone)}</a>
      </li>
    )}
    {HANDLES.map(({ site, label }) => {
      const handle = member[site];
      return (
        handle && (
          <li key={site}>
            {label}:{" "}
            <ExternalLink href={handleUrl(site, handle)}>
              {`@${handle}`}
            </ExternalLink>
          </li>
        )
      );
    })}
    {member.facebookUrl && (
      <li>
        <ExternalLink href={member.facebookUrl}>Facebook</ExternalLink>
      </li>
    )}
    {member.goodreadsUrl && (
      <li>
        <ExternalLink href={member.goodreadsUrl}>Goodreads</ExternalLink>
      </li>
    )}
  </ul>
);

// Every active member, with whatever contact details they've added on their
// profile page. The API leaves out inactive and banned accounts and sorts by
// name.
const MembersPage = () => {
  const { data: session } = authClient.useSession();
  const users = useMembers();

  if (users.isPending) {
    return <p>Loading...</p>;
  }
  if (users.isError) {
    return <p role="alert">{users.error.message}</p>;
  }

  return (
    <div>
      <h1>Members</h1>
      <ul>
        {users.data.map((member) => {
          const isMe = member.id === session?.user.id;
          return (
            <li key={member.id}>
              <article aria-labelledby={`member-${member.id}`}>
                {member.image ? (
                  <img src={member.image} alt="" width={64} height={64} />
                ) : (
                  <span aria-hidden="true">{initials(member)}</span>
                )}
                <h2 id={`member-${member.id}`}>
                  {member.firstName} {member.lastName}
                  {isMe && " (you)"}
                </h2>
                {isMe && <Link to="/profile">Edit your profile</Link>}
                <ContactList member={member} />
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default MembersPage;
