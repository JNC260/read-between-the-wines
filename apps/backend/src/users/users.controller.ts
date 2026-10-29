import { type Request, type Response } from "express";
import * as z from "zod";
import {
  type MergePlaceholderDTO,
  MergeResultSchema,
  PlaceholderSchema,
  type UpdateProfileDTO,
  UserSchema,
} from "shared";
import { getUser } from "../middleware/auth";
import {
  deactivateUser,
  getActiveUsers,
  listPlaceholders,
  mergePlaceholder,
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

export const placeholderList = async (_req: Request, res: Response) => {
  const results = await listPlaceholders();
  res.json(z.encode(PlaceholderSchema.array(), results));
};

export const placeholderMerge = async (
  req: Request<{ id: string }, unknown, MergePlaceholderDTO>,
  res: Response,
) => {
  const result = await mergePlaceholder(req.params.id, req.body.memberId);
  res.json(z.encode(MergeResultSchema, result));
};
