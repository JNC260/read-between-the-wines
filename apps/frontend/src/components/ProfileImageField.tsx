import { type UserDTO } from "shared";

// Sits above the profile form: the member's current photo (or initials, like
// on the members page), a file input to pick a new one, and a button to
// remove it. Saves on its own as soon as a file is picked, separately from
// the "Save profile" button, since the upload is its own request.
const ProfileImageField = ({ user: _user }: { user: UserDTO }) => {
  // TODO:
  //   - <input type="file" accept={PROFILE_IMAGE_TYPES.join(",")}>
  //   - check type and MAX_PROFILE_IMAGE_BYTES before sending, with a
  //     message next to the input, like the other profile fields
  //   - useUploadProfileImage / useRemoveProfileImage from ../hooks
  //   - maybe a preview with URL.createObjectURL while it uploads (and
  //     URL.revokeObjectURL after)
  return null;
};

export default ProfileImageField;
