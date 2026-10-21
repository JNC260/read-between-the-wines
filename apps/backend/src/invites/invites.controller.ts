import { type Request, type Response } from "express";
import * as z from "zod";
import { type CreateInviteDTO, InviteLookupSchema, InviteSchema } from "shared";
import { getUser } from "../middleware/auth";
import {
  inviteMember,
  listInvites,
  lookupInvite,
  revokeInvite,
} from "./invites.service";

export const inviteList = async (_req: Request, res: Response) => {
  const invites = await listInvites();
  res.json(z.encode(InviteSchema.array(), invites));
};

export const inviteCreate = async (
  req: Request<Record<string, string>, unknown, CreateInviteDTO>,
  res: Response,
) => {
  const invite = await inviteMember(req.body.email, getUser(req).id);
  res.status(201).json(z.encode(InviteSchema, invite));
};

export const inviteRevoke = async (
  req: Request<{ id: string }>,
  res: Response,
) => {
  await revokeInvite(req.params.id);
  res.status(204).end();
};

export const inviteLookup = async (
  req: Request<{ token: string }>,
  res: Response,
) => {
  const invite = await lookupInvite(req.params.token);
  res.json(z.encode(InviteLookupSchema, invite));
};
