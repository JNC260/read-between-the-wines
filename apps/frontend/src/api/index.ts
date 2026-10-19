import * as z from "zod";
import { UserSchema } from "shared";

export const getUsersList = async () => {
  const url = `/api/users`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch user list");
  }
  return z.decode(UserSchema.array(), await response.json());
};
