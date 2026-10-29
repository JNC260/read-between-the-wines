import { type UserDTO } from "shared";
import { initials } from "../lib/initials";

// The photo if they've added one, otherwise initials on one of the theme's
// colors, picked by position so neighbors differ. Pass `src` to show a
// different picture, like a preview of a photo that's still uploading.
const Avatar = ({
  member,
  index,
  large = false,
  src = member.image,
}: {
  member: Pick<UserDTO, "firstName" | "lastName" | "image">;
  index: number;
  large?: boolean;
  src?: string | null;
}) => {
  const className = `avatar${large ? " avatar-large" : ""}`;
  return src ? (
    <img className={className} src={src} alt="" />
  ) : (
    <span className={`${className} avatar-${index % 5}`} aria-hidden="true">
      {initials(member)}
    </span>
  );
};

export default Avatar;
