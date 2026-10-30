import { useState } from "react";
import { avatarColor } from "../lib/avatar-color";
import { initials } from "../lib/initials";

// "small" is the overlapping circles next to suggestions and RSVPs (and the
// header), "medium" the members list, "large" a member's details and the
// profile page.
type AvatarSize = "small" | "medium" | "large";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  small: "face",
  medium: "avatar",
  large: "avatar avatar-large",
};

// The photo if they've added one, otherwise initials on the member's own
// color (the same on every page). Pass `src` to show a different picture,
// like a preview of a photo that's still uploading.
const Avatar = ({
  member,
  size = "medium",
  className,
  src = member.image,
}: {
  // lastName and image are optional for the signed-in session's user.
  member: { id: string; firstName: string; lastName?: string; image?: string | null };
  size?: AvatarSize;
  className?: string;
  src?: string | null;
}) => {
  const classes = [SIZE_CLASSES[size], className].filter(Boolean).join(" ");
  // A photo that won't load (its file is gone, or the network dropped it)
  // shows the initials instead of the browser's broken-image icon. Keyed to
  // the URL, so a new photo gets its own try.
  const [failed, setFailed] = useState<string | null>(null);
  return src && src !== failed ? (
    <img className={classes} src={src} alt="" onError={() => setFailed(src)} />
  ) : (
    <span className={`${classes} avatar-color-${avatarColor(member.id)}`} aria-hidden="true">
      {initials(member)}
    </span>
  );
};

export default Avatar;
