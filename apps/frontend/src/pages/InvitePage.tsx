import { type FormEvent, useState } from "react";
import { useParams } from "react-router-dom";
import { type SignUpDTO, SignUpSchema } from "shared";
import * as z from "zod";
import Field from "../components/Field";
import { useInvite, useSignUpWithInvite } from "../hooks";

// Invite links shared by members point here: /invite/<token>.
const InvitePage = () => {
  const { token = "" } = useParams();
  const invite = useInvite(token);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof SignUpDTO, string[]>>
  >({});
  const { mutate, isPending, isSuccess, error } = useSignUpWithInvite();

  if (isSuccess) {
    return (
      <div>
        <h1>Check your email</h1>
        <p>
          We've sent a link to {email}. Tap it to verify your email and you'll
          be signed in.
        </p>
      </div>
    );
  }
  if (invite.isPending) {
    return <p>Checking your invite...</p>;
  }
  if (invite.isError) {
    return <p role="alert">{invite.error.message}</p>;
  }
  if (!invite.data) {
    return (
      <div>
        <h1>This invite has expired</h1>
        <p>
          The link may be old or already used. Ask whoever sent it to make you
          a new one.
        </p>
      </div>
    );
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = SignUpSchema.safeParse({
      email,
      firstName,
      lastName,
      password,
      confirm,
    });
    if (!result.success) {
      setFieldErrors(z.flattenError(result.error).fieldErrors);
      return;
    }
    setFieldErrors({});
    const { data } = result;
    mutate({
      token,
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
    });
  };

  return (
    <div>
      <h1>Join Read Between the Wines</h1>
      <form onSubmit={handleSubmit} noValidate>
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email?.[0]}
        />
        <Field
          id="firstName"
          label="First name"
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          error={fieldErrors.firstName?.[0]}
        />
        <Field
          id="lastName"
          label="Last name"
          autoComplete="family-name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          error={fieldErrors.lastName?.[0]}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password?.[0]}
        />
        <Field
          id="confirm"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={fieldErrors.confirm?.[0]}
        />
        {error && <p role="alert">{error.message}</p>}
        <button type="submit" disabled={isPending}>
          {isPending ? "Creating account..." : "Create account"}
        </button>
      </form>
    </div>
  );
};

export default InvitePage;
