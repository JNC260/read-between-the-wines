import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { type ForgotPasswordDTO, ForgotPasswordSchema } from "shared";
import * as z from "zod";
import Field from "../components/Field";
import { useRequestPasswordReset } from "../hooks";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ForgotPasswordDTO, string[]>>
  >({});
  const { mutate, isPending, isSuccess, error } = useRequestPasswordReset();

  // The same message whether or not the email has an account, so this page
  // can't be used to find out who's a member.
  if (isSuccess) {
    return (
      <div>
        <h1>Check your email</h1>
        <p>
          If that email has an account, we've sent a link to reset your
          password.
        </p>
        <Link to="/login">Back to log in</Link>
      </div>
    );
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = ForgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setFieldErrors(z.flattenError(result.error).fieldErrors);
      return;
    }
    setFieldErrors({});
    mutate(result.data.email);
  };

  return (
    <div>
      <h1>Forgot password</h1>
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
        {error && <p role="alert">{error.message}</p>}
        <button type="submit" disabled={isPending}>
          {isPending ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <Link to="/login">Back to log in</Link>
    </div>
  );
};

export default ForgotPasswordPage;
