import { type Request, type Response } from "express";
import * as z from "zod";
import { UserSchema } from "shared";
import { getUser } from "../middleware/auth";
import { deactivateUser, getAllUsers, reactivateUser } from "./users.service";

export const userList = async (_req: Request, res: Response) => {
  const results = await getAllUsers();
  res.json(z.encode(UserSchema.array(), results));
};

export const userDeactivateSelf = async (req: Request, res: Response) => {
  const user = await deactivateUser(getUser(req).id);
  res.json(z.encode(UserSchema, user));
};

export const userReactivateSelf = async (req: Request, res: Response) => {
  const user = await reactivateUser(getUser(req).id);
  res.json(z.encode(UserSchema, user));
};

export const userDeactivate = async (
  req: Request<{ id: string }>,
  res: Response,
) => {
  const user = await deactivateUser(req.params.id);
  res.json(z.encode(UserSchema, user));
};
