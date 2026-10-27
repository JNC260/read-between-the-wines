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

// After uploadImage, which leaves the parsed file on the request.
export const userUploadImage = async (_req: Request, _res: Response) => {
  // TODO: pass the file's buffer and type to updateProfileImage in
  // users.service, then respond with the updated user, encoded like the
  // other handlers.
  throw new Error("TODO: userUploadImage");
};

export const userRemoveImage = async (_req: Request, _res: Response) => {
  // TODO: call removeProfileImage in users.service.
  throw new Error("TODO: userRemoveImage");
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
