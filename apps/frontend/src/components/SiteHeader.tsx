import { useEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { authClient } from "../lib/auth-client";
import Logo from "./Logo";
import { initials } from "./RsvpButtons";
import SignOutButton from "./SignOutButton";

// Everything a member does less often. A <details> opens and closes without
// any state; the effects close it after a pick or a tap elsewhere.
const AccountMenu = ({ isAdmin }: { isAdmin: boolean }) => {
  const { data: session } = authClient.useSession();
  const menu = useRef<HTMLDetailsElement>(null);
  const location = useLocation();

  useEffect(() => {
    if (menu.current) {
      menu.current.open = false;
    }
  }, [location]);

  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (menu.current && !menu.current.contains(e.target as Node)) {
        menu.current.open = false;
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  if (!session) {
    return null;
  }
  return (
    <details className="account-menu" ref={menu}>
      <summary aria-label="Account menu">
        <span className="face face-me" aria-hidden="true">
          {initials(session.user)}
        </span>
      </summary>
      <ul>
        <li>
          <Link to="/profile">My profile</Link>
        </li>
        <li>
          <Link to="/invite-member">Invite a member</Link>
        </li>
        {isAdmin && (
          <>
            <li>
              <Link to="/events/new">New event</Link>
            </li>
            <li>
              <Link to="/polls/new">New poll</Link>
            </li>
          </>
        )}
        <li>
          <SignOutButton />
        </li>
      </ul>
    </details>
  );
};

// Only shown to signed-in members. The landing page links to suggestions
// and the shelf itself, so the nav keeps just two places.
const SiteHeader = () => {
  const { data: session } = authClient.useSession();
  if (!session) {
    return null;
  }
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="logo-link" aria-label="Read Between the Wines home">
          <Logo />
        </Link>
        <nav aria-label="Main">
          <NavLink to="/events">Events</NavLink>
          <NavLink to="/members" end>
            Members
          </NavLink>
        </nav>
        <AccountMenu isAdmin={!!session.user.isAdmin} />
      </div>
    </header>
  );
};

export default SiteHeader;
