import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { type ResetPasswordDTO, ResetPasswordSchema } from "shared";
import * as z from "zod";
import Field from "../components/Field";
import { useResetPassword } from "../hooks";

// The reset email links to /api/auth/reset-password/<token>, which redirects
// here with ?token=... or, if the link is bad or expired, ?error=INVALID_TOKEN.
const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ResetPasswordDTO, string[]>>
  >({});
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
    const result = ResetPasswordSchema.safeParse({ password, confirm });
    if (!result.success) {
      setFieldErrors(z.flattenError(result.error).fieldErrors);
      return;
    }
    setFieldErrors({});
    mutate({ token, newPassword: result.data.password });
  };

  return (
    <div>
      <h1>Reset password</h1>
      <form onSubmit={handleSubmit} noValidate>
        <Field
          id="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password?.[0]}
        />
        <Field
          id="confirm"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={fieldErrors.confirm?.[0]}
        />
        {error && <p role="alert">{error.message}</p>}
        <button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Set new password"}
        </button>
      </form>
    </div>
  );
};

export default ResetPasswordPage;
