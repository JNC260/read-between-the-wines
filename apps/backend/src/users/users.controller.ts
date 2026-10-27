import { type Request, type Response } from "express";
import * as z from "zod";
import { type UpdateProfileDTO, UserSchema } from "shared";
import { getUser } from "../middleware/auth";
import {
  deactivateUser,
  getActiveUsers,
  reactivateUser,
  updateProfile,
} from "./users.service";

export const userList = async (_req: Request, res: Response) => {
  const results = await getActiveUsers();
  res.json(z.encode(UserSchema.array(), results));
};

export const userUpdateSelf = async (
  req: Request<Record<string, string>, unknown, UpdateProfileDTO>,
  res: Response,
) => {
  const user = await updateProfile(getUser(req).id, req.body);
  res.json(z.encode(UserSchema, user));
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
