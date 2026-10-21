import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useResetPassword } from "../hooks";

// Better Auth's limits for email and password accounts.
const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

// The reset email links to /api/auth/reset-password/<token>, which redirects
// here with ?token=... or, if the link is bad or expired, ?error=INVALID_TOKEN.
const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const { mutate, isPending, isSuccess, error } = useResetPassword();

  if (!token || searchParams.get("error")) {
    return (
      <div>
        <h1>Reset password</h1>
        <p>This reset link is invalid or has expired.</p>
        <Link to="/forgot-password">Request a new one</Link>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div>
        <h1>Reset password</h1>
        <p>Your password has been updated.</p>
        <Link to="/login">Log in</Link>
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
    mutate({ token, newPassword: password });
  };

  return (
    <div>
      <h1>Reset password</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="password">New password</label>
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
          <label htmlFor="confirm">Confirm new password</label>
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
          {isPending ? "Saving..." : "Set new password"}
        </button>
      </form>
    </div>
  );
};

export default ResetPasswordPage;
