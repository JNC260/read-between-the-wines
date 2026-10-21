import { type FormEvent, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useInvite, useSignUpWithInvite } from "../hooks";
import { authClient } from "../lib/auth-client";

// Better Auth's limits for email and password accounts.
const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

// The invite email links here: /invite/<token>.
const InvitePage = () => {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const invite = useInvite(token);
  const { refetch: refetchSession } = authClient.useSession();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const { mutate, isPending, error } = useSignUpWithInvite();

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
          The link may be old or already used. Ask the club organizer to send
          you a new one.
        </p>
      </div>
    );
  }

  const { email } = invite.data;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirm) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    mutate(
      { token, email, password, firstName, lastName },
      {
        // Signed in by now; refresh the session so "/" shows them as such.
        onSuccess: async () => {
          await refetchSession();
          navigate("/", { replace: true });
        },
      },
    );
  };

  return (
    <div>
      <h1>Join Read Between the Wines</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>
          {/* The invite is for exactly this email, so it can't be changed. */}
          <input id="email" type="email" value={email} readOnly />
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
