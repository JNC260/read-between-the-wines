import * as z from "zod";
import { UserSchema } from "shared";
import { authClient } from "../lib/auth-client";

export const getUsersList = async () => {
  const url = `/api/users`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch user list");
  }
  return z.decode(UserSchema.array(), await response.json());
};

// Better Auth's client returns { data, error } instead of throwing; React
// Query needs a thrown error to set a mutation's error state.
export const resetPassword = async (body: {
  token: string;
  newPassword: string;
}) => {
  const { error } = await authClient.resetPassword(body);
  if (error) {
    throw new Error(error.message ?? "Failed to reset password");
  }
};
