import { type Request, type Response } from "express";
import * as z from "zod";
import { type CreateUserDTO, UserSchema } from "shared";
import { createUser, getAllUsers } from "./users.service";

export const userList = async (_req: Request, res: Response) => {
  const results = await getAllUsers();
  res.json(z.encode(UserSchema.array(), results));
};

// validate(CreateUserSchema) runs first, so the body is already parsed.
export const userCreate = async (
  req: Request<Record<string, string>, unknown, CreateUserDTO>,
  res: Response,
) => {
  const user = await createUser(req.body);
  res.status(201).json(z.encode(UserSchema, user));
};
