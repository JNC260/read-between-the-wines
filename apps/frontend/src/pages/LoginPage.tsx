import { type FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useSignIn } from "../hooks";
import { authClient } from "../lib/auth-client";

const LoginPage = () => {
  const {
    data: session,
    isPending: sessionPending,
    refetch,
  } = authClient.useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { mutate, isPending, error } = useSignIn();

  // Set by RequireAuth when it redirected a signed-out member.
  const from: string = location.state?.from?.pathname ?? "/";

  if (sessionPending) {
    return null;
  }
  if (session) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    mutate(
      { email, password },
      {
        // Wait for the session to refresh first. Otherwise RequireAuth on the
        // next page still sees "signed out" and bounces them to "/".
        onSuccess: async (user) => {
          await refetch();
          navigate(user.status === "INACTIVE" ? "/reactivate" : from, {
            replace: true,
          });
        },
      },
    );
  };

  return (
    <div>
      <h1>Log in</h1>
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
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p role="alert">{error.message}</p>}
        <button type="submit" disabled={isPending}>
          {isPending ? "Logging in..." : "Log in"}
        </button>
      </form>
      <Link to="/forgot-password">Forgot password?</Link>
    </div>
  );
};

export default LoginPage;
