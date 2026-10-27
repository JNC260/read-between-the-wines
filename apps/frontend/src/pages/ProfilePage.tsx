import {
  type ChangeEvent,
  type FormEvent,
  type InputHTMLAttributes,
  useState,
} from "react";
import * as z from "zod";
import {
  formatPhone,
  type UpdateProfileDTO,
  UpdateProfileSchema,
  type UserDTO,
} from "shared";
import ProfileImageField from "../components/ProfileImageField";
import { useMembers, useUpdateProfile } from "../hooks";
import { authClient } from "../lib/auth-client";

type FieldName = keyof UpdateProfileDTO;
type Optional = Exclude<FieldName, "firstName" | "lastName">;

// Typed as a username; the rest are full links.
const HANDLES: { name: Optional; label: string }[] = [
  { name: "instagram", label: "Instagram" },
  { name: "tiktok", label: "TikTok" },
  { name: "x", label: "X" },
  { name: "venmo", label: "Venmo" },
];

const LINKS: { name: Optional; label: string; placeholder: string }[] = [
  {
    name: "facebookUrl",
    label: "Facebook",
    placeholder: "https://www.facebook.com/yourname",
  },
  {
    name: "goodreadsUrl",
    label: "Goodreads",
    placeholder: "https://www.goodreads.com/user/show/...",
  },
];

const initialValues = (user: UserDTO): Record<FieldName, string> => ({
  firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone ? formatPhone(user.phone) : "",
  facebookUrl: user.facebookUrl ?? "",
  goodreadsUrl: user.goodreadsUrl ?? "",
  instagram: user.instagram ?? "",
  tiktok: user.tiktok ?? "",
  x: user.x ?? "",
  venmo: user.venmo ?? "",
});

// A labelled input with its error message, if any, read out with it.
const Field = ({
  id,
  label,
  error,
  prefix,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  prefix?: string;
}) => (
  <div>
    <label htmlFor={id}>{label}</label>
    {prefix && <span aria-hidden="true">{prefix}</span>}
    <input
      id={id}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : undefined}
      {...props}
    />
    {error && (
      <p id={`${id}-error`} role="alert">
        {error}
      </p>
    )}
  </div>
);

// Rendered once the member has loaded, since `user` only seeds the inputs.
const ProfileForm = ({ user }: { user: UserDTO }) => {
  const { refetch } = authClient.useSession();
  const { mutate, isPending, isSuccess, error, reset } = useUpdateProfile();
  const [values, setValues] = useState(() => initialValues(user));
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FieldName, string[]>>
  >({});

  const set = (name: FieldName, value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    // So "Profile saved" doesn't linger once they start editing again.
    reset();
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Every field is sent, so an emptied input clears it (null) rather than
    // leaving the old value.
    const body = Object.fromEntries(
      Object.entries(values).map(([name, value]) => [
        name,
        value.trim() === "" && name !== "firstName" && name !== "lastName"
          ? null
          : value,
      ]),
    );
    const result = UpdateProfileSchema.safeParse(body);
    if (!result.success) {
      setFieldErrors(z.flattenError(result.error).fieldErrors);
      return;
    }
    setFieldErrors({});
    // The session carries firstName, which the rest of the site greets them by.
    mutate(result.data, { onSuccess: () => refetch() });
  };

  // The props every profile input shares.
  const bind = (name: FieldName) => ({
    id: name,
    value: values[name],
    onChange: (e: ChangeEvent<HTMLInputElement>) =>
      set(name, e.target.value),
    error: fieldErrors[name]?.[0],
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Field {...bind("firstName")} label="First name" autoComplete="given-name" />
      <Field {...bind("lastName")} label="Last name" autoComplete="family-name" />
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={user.email}
          disabled
          aria-describedby="email-hint"
        />
        <p id="email-hint">
          Email can't be changed here yet. Ask an admin if you need to update
          it.
        </p>
      </div>

      <h2>Contact and socials</h2>
      <p>
        Everything below is optional, and every member can see what you add.
        Leave a field empty to keep it to yourself.
      </p>
      <Field
        {...bind("phone")}
        // Formats as they type, e.g. (555) 123-4567.
        onChange={(e) => set("phone", formatPhone(e.target.value))}
        label="Phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="(555) 123-4567"
      />
      {HANDLES.map(({ name, label }) => (
        <Field
          key={name}
          {...bind(name)}
          label={label}
          prefix="@"
          placeholder="username or profile link"
          autoCapitalize="none"
          spellCheck={false}
        />
      ))}
      {LINKS.map(({ name, label, placeholder }) => (
        <Field
          key={name}
          {...bind(name)}
          label={label}
          type="url"
          placeholder={placeholder}
        />
      ))}

      {error && <p role="alert">{error.message}</p>}
      {isSuccess && <p role="status">Profile saved.</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
};

// There's no GET /users/me: the member list already has everything, and
// it's what the members page will show.
const ProfilePage = () => {
  const { data: session } = authClient.useSession();
  const users = useMembers();

  if (users.isPending) {
    return <p>Loading...</p>;
  }
  if (users.isError) {
    return <p role="alert">{users.error.message}</p>;
  }
  const me = users.data.find((u) => u.id === session?.user.id);
  if (!me) {
    return <p role="alert">We couldn't find your profile.</p>;
  }

  return (
    <div>
      <h1>My profile</h1>
      <ProfileImageField user={me} />
      <ProfileForm user={me} />
    </div>
  );
};

export default ProfilePage;
