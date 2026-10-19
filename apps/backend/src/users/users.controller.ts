import { type Request, type Response } from "express";
import * as z from "zod";
import { CreateUserSchema, UserSchema } from "shared";
import { createUser, getAllUsers } from "./users.service";

export const userList = async (_req: Request, res: Response) => {
  const results = await getAllUsers();
  res.json(z.encode(UserSchema.array(), results));
};

export const userCreate = async (req: Request, res: Response) => {
  // Bad input is the client's fault (400). Any other ZodError, like the
  // encode() below failing, is a server bug and falls through to a 500.
  const input = CreateUserSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Invalid request", details: z.flattenError(input.error) });
    return;
  }
  const user = await createUser(input.data);
  res.status(201).json(z.encode(UserSchema, user));
};
