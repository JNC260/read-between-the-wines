import { type Request, type Response } from "express";
import * as z from "zod";
import {
  type EmailSettingsDTO,
  EmailSettingsSchema,
  type MergePlaceholderDTO,
  MergeResultSchema,
  PlaceholderSchema,
  type ProfileImageType,
  type UpdateProfileDTO,
  UserSchema,
} from "shared";
import { getUser } from "../middleware/auth";
import {
  banUser,
  deactivateUser,
  getActiveUsers,
  getEmailSettings,
  listAccounts,
  listPlaceholders,
  mergePlaceholder,
  reactivateUser,
  removeProfileImage,
  unbanUser,
  updateEmailSettings,
  updateProfile,
  updateProfileImage,
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

// After uploadImage, which only calls this with a file of an allowed type
// on req.file, the same way validate() leaves a checked req.body.
export const userUploadImage = async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File;
  const user = await updateProfileImage(getUser(req).id, {
    buffer: file.buffer,
    contentType: file.mimetype as ProfileImageType,
  });
  res.json(z.encode(UserSchema, user));
};

export const userRemoveImage = async (req: Request, res: Response) => {
  const user = await removeProfileImage(getUser(req).id);
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

// GET /users/me/notifications -> the emails this member has turned off
export const emailSettingsGet = async (req: Request, res: Response) => {
  const settings = await getEmailSettings(getUser(req).id);
  res.json(z.encode(EmailSettingsSchema, settings));
};

// PUT /users/me/notifications
export const emailSettingsUpdate = async (
  req: Request<Record<string, string>, unknown, EmailSettingsDTO>,
  res: Response,
) => {
  const settings = await updateEmailSettings(getUser(req).id, req.body);
  res.json(z.encode(EmailSettingsSchema, settings));
};

// GET /users/accounts (admins) -> every real account, with its status
export const accountList = async (_req: Request, res: Response) => {
  res.json(z.encode(UserSchema.array(), await listAccounts()));
};

// POST /users/:id/ban (admins)
export const userBan = async (req: Request<{ id: string }>, res: Response) => {
  const user = await banUser(getUser(req).id, req.params.id);
  res.json(z.encode(UserSchema, user));
};

// POST /users/:id/unban (admins)
export const userUnban = async (req: Request<{ id: string }>, res: Response) => {
  const user = await unbanUser(req.params.id);
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
