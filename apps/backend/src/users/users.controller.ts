import { type Request, type Response } from "express";
import * as z from "zod";
import { UserSchema } from "shared";
import { getAllUsers } from "./users.service";

export const userList = async (_req: Request, res: Response) => {
  const results = await getAllUsers();
  res.json(z.encode(UserSchema.array(), results));
};
