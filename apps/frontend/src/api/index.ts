import * as z from "zod";
import { InviteLookupSchema, UserSchema } from "shared";
import { authClient } from "../lib/auth-client";

// Better Auth's client returns { data, error } instead of throwing; React
// Query needs a thrown error to set a mutation's error state.
const unwrap = <T>(
  result: { data: T | null; error: { message?: string } | null },
  fallback: string,
): T => {
  if (result.error) {
    throw new Error(result.error.message ?? fallback);
  }
  return result.data as T;
};

// Our own API's errors look like { error: { code, message } }.
const throwApiError = async (response: Response, fallback: string) => {
  const body = await response.json().catch(() => null);
  throw new Error(body?.error?.message ?? fallback);
};

export const getUsersList = async () => {
  const url = `/api/users`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch user list");
  }
  return z.decode(UserSchema.array(), await response.json());
};

// Returns null for an invalid or expired invite, so the page can show a
// friendly message instead of an error (and React Query doesn't retry).
export const getInvite = async (token: string) => {
  const response = await fetch(`/api/invites/${encodeURIComponent(token)}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    await throwApiError(response, "Failed to check invite");
  }
  return z.decode(InviteLookupSchema, await response.json());
};

export const signIn = async (body: { email: string; password: string }) => {
  return unwrap(await authClient.signIn.email(body), "Failed to sign in")
    .user;
};

export const signOut = async () => {
  unwrap(await authClient.signOut(), "Failed to sign out");
};

// Invited members are verified at sign-up but not signed in, so sign them in
// straight after.
export const signUpWithInvite = async (input: {
  token: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) => {
  // Built separately because Better Auth's types don't know about
  // inviteToken, though the server accepts it. TypeScript only rejects
  // unknown keys in inline objects.
  const body = {
    email: input.email,
    password: input.password,
    name: `${input.firstName} ${input.lastName}`,
    firstName: input.firstName,
    lastName: input.lastName,
    inviteToken: input.token,
  };
  unwrap(await authClient.signUp.email(body), "Failed to create account");
  return signIn({ email: input.email, password: input.password });
};

export const requestPasswordReset = async (email: string) => {
  unwrap(
    await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    }),
    "Failed to request a password reset",
  );
};

export const resetPassword = async (body: {
  token: string;
  newPassword: string;
}) => {
  unwrap(await authClient.resetPassword(body), "Failed to reset password");
};

export const reactivateAccount = async () => {
  const response = await fetch(`/api/users/me/reactivate`, { method: "POST" });
  if (!response.ok) {
    await throwApiError(response, "Failed to reactivate account");
  }
};
