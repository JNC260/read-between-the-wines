import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatPhone, handleUrl, type UserDTO } from "shared";
import Avatar from "../components/Avatar";
import SocialIcon, { type SocialSite } from "../components/SocialIcon";
import { useMembers } from "../hooks";
import { authClient } from "../lib/auth-client";

type Social = { site: SocialSite; label: string; href: string; shown: string };

// Only what the member chose to add, in a fixed order. Handles are stored
// bare, so their links are built here; Facebook and Goodreads are full links.
const socials = (m: UserDTO): Social[] =>
  [
    m.instagram && {
      site: "instagram" as const,
      label: "Instagram",
      href: handleUrl("instagram", m.instagram),
      shown: `@${m.instagram}`,
    },
    m.tiktok && {
      site: "tiktok" as const,
      label: "TikTok",
      href: handleUrl("tiktok", m.tiktok),
      shown: `@${m.tiktok}`,
    },
    m.x && {
      site: "x" as const,
      label: "X",
      href: handleUrl("x", m.x),
      shown: `@${m.x}`,
    },
    m.facebookUrl && {
      site: "facebook" as const,
      label: "Facebook",
      href: m.facebookUrl,
      shown: "Facebook profile",
    },
    m.goodreadsUrl && {
      site: "goodreads" as const,
      label: "Goodreads",
      href: m.goodreadsUrl,
      shown: "Goodreads shelves",
    },
    m.venmo && {
      site: "venmo" as const,
      label: "Venmo",
      href: handleUrl("venmo", m.venmo),
      shown: `@${m.venmo}`,
    },
  ].filter((s): s is Social => !!s);

const fullName = (m: UserDTO) => `${m.firstName} ${m.lastName}`;

const ExternalLink = ({
  href,
  className,
  children,
  label,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  label?: string;
}) => (
  <a
    href={href}
    className={className}
    aria-label={label}
    target="_blank"
    rel="noreferrer"
  >
    {children}
  </a>
);

// Copies on tap, for people on a computer who can't just tap to call.
const CopyButton = ({ value, label }: { value: string; label: string }) => {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      className="copy-button"
      aria-label={`Copy ${label}`}
      onClick={() =>
        navigator.clipboard?.writeText(value).then(() => setCopied(true))
      }
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
};

// A sheet from the bottom on phones, a centered window on wider screens.
// Closes on Escape, the close button or a tap outside, and hands focus back
// to the card that opened it.
const MemberDetails = ({
  member,
  isMe,
  onClose,
}: {
  member: UserDTO;
  isMe: boolean;
  onClose: () => void;
}) => {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // Stops the page behind from scrolling under the sheet.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, [onClose]);

  const links = socials(member);
  const phone = member.phone && formatPhone(member.phone);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div
        className="member-details"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-details-name"
      >
        <button
          ref={closeButton}
          type="button"
          className="close-button"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
        <div className="member-details-head">
          <Avatar member={member} size="large" />
          <h2 id="member-details-name">
            {fullName(member)}
            {isMe && <span className="you-badge">You</span>}
          </h2>
          {member.memberSince && (
            <p className="muted">Member since {member.memberSince}</p>
          )}
        </div>

        <div className="quick-actions">
          {member.phone && <a href={`sms:${member.phone}`}>Text</a>}
          {member.phone && <a href={`tel:${member.phone}`}>Call</a>}
          <a href={`mailto:${member.email}`}>Email</a>
        </div>
        {member.venmo && (
          <ExternalLink
            href={handleUrl("venmo", member.venmo)}
            className="button-link venmo-button"
          >
            <SocialIcon site="venmo" />
            Pay {member.firstName} on Venmo
          </ExternalLink>
        )}

        <section aria-labelledby="member-contact">
          <h3 id="member-contact" className="eyebrow">
            Contact
          </h3>
          <ul className="detail-rows">
            {phone && (
              <li>
                <span className="detail-text">
                  <small>Phone</small>
                  {phone}
                </span>
                <CopyButton value={phone} label="phone number" />
              </li>
            )}
            <li>
              <span className="detail-text">
                <small>Email</small>
                {member.email}
              </span>
              <CopyButton value={member.email} label="email" />
            </li>
          </ul>
        </section>

        {links.length > 0 && (
          <section aria-labelledby="member-socials">
            <h3 id="member-socials" className="eyebrow">
              Find {isMe ? "me" : member.firstName} on
            </h3>
            <ul className="detail-rows">
              {links.map((s) => (
                <li key={s.site}>
                  <SocialIcon site={s.site} />
                  <ExternalLink href={s.href} className="detail-text">
                    <small>{s.label}</small>
                    {s.shown}
                  </ExternalLink>
                  <span className="muted" aria-hidden="true">
                    ↗
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {isMe && (
          <Link to="/profile" className="button-link">
            Edit your profile
          </Link>
        )}
      </div>
    </>
  );
};

// Every active member. The API leaves out inactive and banned accounts and
// sorts by name. Each card opens its details; the icons link straight out.
const MembersPage = () => {
  const { data: session } = authClient.useSession();
  const users = useMembers();
  const [openId, setOpenId] = useState<string | null>(null);
  // Stable, so the details' effect doesn't re-run (and refocus) each render.
  const close = useCallback(() => setOpenId(null), []);

  if (users.isPending) {
    return <p>Loading...</p>;
  }
  if (users.isError) {
    return <p role="alert">{users.error.message}</p>;
  }

  const openIndex = users.data.findIndex((m) => m.id === openId);

  return (
    <div className="members-page">
      <div className="page-head">
        <div>
          <h1>Members</h1>
          <p className="muted">
            {users.data.length} {users.data.length === 1 ? "reader" : "readers"}
          </p>
        </div>
        <Link to="/invite-member" className="button-link button-quiet">
          Invite a member
        </Link>
      </div>

      <ul className="member-list">
        {users.data.map((member) => {
          const isMe = member.id === session?.user.id;
          // Venmo isn't a social; it gets its own Pay button in the details.
          const links = socials(member).filter((s) => s.site !== "venmo");
          return (
            <li key={member.id}>
              <article className="card member-card" aria-labelledby={`member-${member.id}`}>
                <Avatar member={member} />
                <div className="member-card-text">
                  <h2 id={`member-${member.id}`}>
                    <button
                      type="button"
                      className="stretched-link"
                      onClick={() => setOpenId(member.id)}
                    >
                      {fullName(member)}
                    </button>
                    {isMe && <span className="you-badge">You</span>}
                  </h2>
                  {member.memberSince && (
                    <p className="muted">Member since {member.memberSince}</p>
                  )}
                  {links.length > 0 && (
                    <ul className="social-links above-link">
                      {links.map((s) => (
                        <li key={s.site}>
                          <ExternalLink
                            href={s.href}
                            label={`${member.firstName} on ${s.label}`}
                          >
                            <SocialIcon site={s.site} />
                          </ExternalLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {openIndex >= 0 && (
        <MemberDetails
          member={users.data[openIndex]}
          isMe={users.data[openIndex].id === session?.user.id}
          onClose={close}
        />
      )}
    </div>
  );
};

export default MembersPage;
