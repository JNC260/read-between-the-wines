import { type FormEvent, useState } from "react";
import { useParams } from "react-router-dom";
import { useInvite, useSignUpWithInvite } from "../hooks";

// Better Auth's limits for email and password accounts.
const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

// Invite links shared by members point here: /invite/<token>.
const InvitePage = () => {
  const { token = "" } = useParams();
  const invite = useInvite(token);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState(false);
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
    if (password !== confirm) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    mutate({ token, email, password, firstName, lastName });
  };

  return (
    <div>
      <h1>Join Read Between the Wines</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="firstName">First name</label>
          <input
            id="firstName"
            autoComplete="given-name"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="lastName">Last name</label>
          <input
            id="lastName"
            autoComplete="family-name"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_LENGTH}
            maxLength={MAX_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="confirm">Confirm password</label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {mismatch && <p role="alert">Passwords don't match.</p>}
        {error && <p role="alert">{error.message}</p>}
        <button type="submit" disabled={isPending}>
          {isPending ? "Creating account..." : "Create account"}
        </button>
      </form>
    </div>
  );
};

export default InvitePage;
