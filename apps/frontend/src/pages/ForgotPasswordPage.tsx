import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useRequestPasswordReset } from "../hooks";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
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
    mutate(email);
  };

  return (
    <div>
      <h1>Forgot password</h1>
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
