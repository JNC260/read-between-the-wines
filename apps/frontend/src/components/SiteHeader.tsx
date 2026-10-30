import { useEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { authClient } from "../lib/auth-client";
import { initials } from "../lib/initials";
import Logo from "./Logo";
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
              <Link to="/meetings/new">New meeting</Link>
            </li>
            <li>
              <Link to="/polls/new">New poll</Link>
            </li>
            <li>
              <Link to="/members/legacy">Legacy members</Link>
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

// Line icons for the phone tab bar, drawn on a 24px grid.
const ICONS = {
  home: "M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z",
  meetings: "M4 6.5h16V20H4zM4 10.5h16M8.5 4v4M15.5 4v4",
  books: "M5 4.5h5.5a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 0-1.5-1.5H5zM19 4.5h-5.5A1.5 1.5 0 0 0 12 6v14a1.5 1.5 0 0 1 1.5-1.5H19z",
  members:
    "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19.5a5.5 5.5 0 0 1 11 0M16 11a2.5 2.5 0 1 0 0-5M17 14.5a4.5 4.5 0 0 1 3.5 5",
};

const TabIcon = ({ name }: { name: keyof typeof ICONS }) => (
  <svg className="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d={ICONS[name]} />
  </svg>
);

// One nav for every screen size: a row of pills in the header on wider
// screens, a tab bar along the bottom on phones (see styles.css). Home is
// only a tab on phones; wider screens have the logo for that.
const MainNav = () => {
  const { pathname } = useLocation();
  // The suggestions, the shelf and suggesting a book are all "Books", so
  // NavLink's own matching (by its one URL) isn't enough here.
  const inBooks = pathname.startsWith("/books");
  return (
    <nav aria-label="Main" className="main-nav">
      <NavLink to="/" end className="nav-home">
        <TabIcon name="home" />
        Home
      </NavLink>
      <NavLink to="/meetings">
        <TabIcon name="meetings" />
        Meetings
      </NavLink>
      <Link to="/books/suggestions" aria-current={inBooks ? "page" : undefined}>
        <TabIcon name="books" />
        Books
      </Link>
      <NavLink to="/members" end>
        <TabIcon name="members" />
        Members
      </NavLink>
    </nav>
  );
};

// Only shown to signed-in members.
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
        <MainNav />
        <AccountMenu isAdmin={!!session.user.isAdmin} />
      </div>
    </header>
  );
};

export default SiteHeader;
