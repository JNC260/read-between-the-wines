// Members can type a handle (jen, @jen) or paste their profile link; either
// way we store just the handle and build the link when showing it.

export type HandleSite = "instagram" | "tiktok" | "x" | "venmo";

const HANDLE_HOSTS: Record<HandleSite, string[]> = {
  instagram: ["instagram.com"],
  tiktok: ["tiktok.com"],
  x: ["x.com", "twitter.com"],
  venmo: ["venmo.com"],
};

// Loose on purpose: each site has its own rules, and we only need to know
// it's a single word that's safe to put in a link.
export const HANDLE_PATTERN = /^[A-Za-z0-9._-]{1,50}$/;

const PROFILE_BASE: Record<HandleSite, string> = {
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/@",
  x: "https://x.com/",
  venmo: "https://venmo.com/u/",
};

const toUrl = (input: string): URL | null => {
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
};

const hostMatches = (url: URL, hosts: string[]) => {
  const host = url.hostname.toLowerCase();
  return hosts.some((h) => host === h || host.endsWith(`.${h}`));
};

// The handle from "jen", "@jen" or a profile link on that site, such as
// instagram.com/jen, tiktok.com/@jen or venmo.com/u/jen. Anything else comes
// back trimmed but otherwise unchanged, so validation can reject it.
export function parseHandle(site: HandleSite, input: string): string {
  const trimmed = input.trim();
  if (!trimmed.includes("/")) {
    return trimmed.replace(/^@/, "");
  }
  const url = toUrl(trimmed);
  if (!url || !hostMatches(url, HANDLE_HOSTS[site])) {
    return trimmed;
  }
  const segments = url.pathname.split("/").filter(Boolean);
  // Venmo profile links are venmo.com/u/<handle>, or venmo.com/<handle>.
  const handle = site === "venmo" && segments[0] === "u" ? segments[1] : segments[0];
  return handle ? handle.replace(/^@/, "") : trimmed;
}

export const handleUrl = (site: HandleSite, handle: string) =>
  `${PROFILE_BASE[site]}${encodeURIComponent(handle)}`;

export type ProfileUrlSite = "facebook" | "goodreads";

const PROFILE_URL_HOSTS: Record<ProfileUrlSite, string[]> = {
  facebook: ["facebook.com", "fb.com"],
  goodreads: ["goodreads.com"],
};

// Facebook and Goodreads profile links aren't just a handle
// (facebook.com/profile.php?id=..., goodreads.com/user/show/123-jen), so we
// keep the whole link. Adds https:// when it's missing. Anything that isn't
// a link to a page on that site comes back trimmed, so validation can reject it.
export function parseProfileUrl(site: ProfileUrlSite, input: string): string {
  const trimmed = input.trim();
  const url = toUrl(trimmed);
  if (!url || !hostMatches(url, PROFILE_URL_HOSTS[site]) || url.pathname === "/") {
    return trimmed;
  }
  url.protocol = "https:";
  return url.href;
}

export const isProfileUrl = (site: ProfileUrlSite, value: string) => {
  if (!/^https:\/\//.test(value)) {
    return false;
  }
  const url = toUrl(value);
  return !!url && hostMatches(url, PROFILE_URL_HOSTS[site]) && url.pathname !== "/";
};
