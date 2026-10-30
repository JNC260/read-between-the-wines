import { type Request, type Response } from "express";
import * as z from "zod";
import { CreatedInviteSchema, InviteLookupSchema, OpenInviteSchema } from "shared";
import { getUser } from "../middleware/auth";
import {
  createInviteLink,
  listOpenInvites,
  lookupInvite,
  revokeInvite,
} from "./invites.service";

export const inviteList = async (_req: Request, res: Response) => {
  const invites = await listOpenInvites();
  res.json(z.encode(OpenInviteSchema.array(), invites));
};

export const inviteCreate = async (req: Request, res: Response) => {
  const invite = await createInviteLink(getUser(req).id);
  res.status(201).json(z.encode(CreatedInviteSchema, invite));
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
