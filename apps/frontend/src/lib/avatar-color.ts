// How many avatar colors styles.css defines (.avatar-color-0 to -7).
export const AVATAR_COLORS = 8;

// The same member always gets the same color, on every page, by hashing
// their id. Two members can share one (there are only eight), so the
// initials still do the real telling apart.
export const avatarColor = (id: string) => {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % AVATAR_COLORS;
};
