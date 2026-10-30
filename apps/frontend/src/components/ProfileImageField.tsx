import { type ChangeEvent, useEffect, useState } from "react";
import {
  isProfileImageType,
  MAX_PROFILE_IMAGE_BYTES,
  PROFILE_IMAGE_TYPES,
  type UserDTO,
} from "shared";
import { useRemoveProfileImage, useUploadProfileImage } from "../hooks";
import Avatar from "./Avatar";

const MAX_MB = MAX_PROFILE_IMAGE_BYTES / 1024 / 1024;

// The same checks the server makes, so a wrong file gets an answer at once
// instead of after uploading 10 MB. The server still checks: this only
// saves a trip.
const problemWith = (file: File) => {
  if (!isProfileImageType(file.type)) {
    return "Photos have to be JPEG, PNG or WebP";
  }
  if (file.size > MAX_PROFILE_IMAGE_BYTES) {
    return `Photos can be up to ${MAX_MB} MB`;
  }
  return null;
};

// Sits above the profile form: the member's current photo (or initials, like
// on the members page), a file input to pick a new one, and a button to
// remove it. Saves on its own as soon as a file is picked, separately from
// the "Save profile" button, since the upload is its own request.
const ProfileImageField = ({ user }: { user: UserDTO }) => {
  const upload = useUploadProfileImage();
  const remove = useRemoveProfileImage();
  const [preview, setPreview] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const busy = upload.isPending || remove.isPending;
  const error = problem ?? (upload.error ?? remove.error)?.message;

  // Object URLs hold the file in memory until revoked, so each preview is
  // released when it's replaced or the page closes.
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handlePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Cleared so picking the same file again still counts as a change.
    e.target.value = "";
    if (!file) {
      return;
    }
    upload.reset();
    remove.reset();
    setSaved(null);
    const found = problemWith(file);
    setProblem(found);
    if (found) {
      return;
    }
    setPreview(URL.createObjectURL(file));
    upload.mutate(file, {
      onSuccess: () => setSaved("Photo saved."),
      // The saved photo (or the old one, after an error) takes over.
      onSettled: () => setPreview(null),
    });
  };

  const handleRemove = () => {
    upload.reset();
    setProblem(null);
    setSaved(null);
    remove.mutate(undefined, { onSuccess: () => setSaved("Photo removed.") });
  };

  return (
    <section className="profile-photo" aria-label="Profile photo">
      <Avatar member={user} size="large" src={preview ?? user.image} />
      <div className="profile-photo-controls">
        <label htmlFor="profile-photo">
          {user.image ? "Change photo" : "Add a photo"}
        </label>
        <input
          id="profile-photo"
          type="file"
          accept={PROFILE_IMAGE_TYPES.join(",")}
          disabled={busy}
          onChange={handlePick}
          aria-describedby="profile-photo-hint"
        />
        <p className="muted" id="profile-photo-hint">
          JPEG, PNG or WebP, up to {MAX_MB} MB. It's cropped to a square.
        </p>
        {user.image && (
          <button type="button" onClick={handleRemove} disabled={busy}>
            {remove.isPending ? "Removing..." : "Remove photo"}
          </button>
        )}
        {upload.isPending && <p role="status">Uploading...</p>}
        {saved && !busy && <p role="status">{saved}</p>}
        {error && <p role="alert">{error}</p>}
      </div>
    </section>
  );
};

export default ProfileImageField;
