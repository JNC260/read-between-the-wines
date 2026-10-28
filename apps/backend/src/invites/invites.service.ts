import { createHash, randomBytes } from "node:crypto";
import {
  type CreatedInviteDTO,
  type InviteDTO,
  type InviteLookupDTO,
} from "shared";
import { config } from "../lib/config";
import { ConflictError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";

const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

// Tokens are 32 random bytes, so a fast hash is enough. Slow hashes like
// bcrypt are for passwords, which are guessable.
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

// Creates an invite. Returns the raw token, which isn't stored anywhere; the
// caller has to deliver it.
export const createInvite = async (
  invitedById: string | null,
): Promise<{ invite: InviteDTO; token: string }> => {
  const token = randomBytes(32).toString("base64url");
  const invite = await prisma.invite.create({
    data: {
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITE_LIFETIME_MS),
      invitedById,
    },
  });
  return { invite, token };
};

// For a member to text or share. Anyone with the link can sign up once, so
// it's only shown to the member who made it.
export const createInviteLink = async (
  invitedById: string,
): Promise<CreatedInviteDTO> => {
  // The public site address, never a request's Host header, so a link
  // can't be pointed somewhere else.
  const { invite, token } = await createInvite(invitedById);
  return { ...invite, url: `${config.BETTER_AUTH_URL}/invite/${token}` };
};

export const listInvites = (): Promise<InviteDTO[]> => {
  return prisma.invite.findMany({ orderBy: { createdAt: "desc" } });
};

export const revokeInvite = async (id: string): Promise<void> => {
  const invite = await prisma.invite.findUnique({ where: { id } });
  if (!invite) {
    throw new NotFoundError("Invite not found");
  }
  if (invite.usedAt) {
    throw new ConflictError("That invite has already been used");
  }
  await prisma.invite.delete({ where: { id } });
};

// For the public invite page. Every kind of bad link gets the same 404, so
// the page can't be used to learn whether a token ever existed.
export const lookupInvite = async (token: string): Promise<InviteLookupDTO> => {
  const invite = await prisma.invite.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!invite || invite.usedAt || invite.expiresAt <= new Date()) {
    throw new NotFoundError("This invite has expired or isn't valid");
  }
  return invite;
};

// Used by the sign-up hook in lib/auth.ts. A valid token only shows a member
// vouched for this person; their email is checked by verification instead.
export const isInviteValid = async (token: string): Promise<boolean> => {
  const invite = await prisma.invite.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  return !!invite && !invite.usedAt && invite.expiresAt > new Date();
};

export const markInviteUsed = async (token: string): Promise<void> => {
  await prisma.invite.updateMany({
    where: { tokenHash: hashToken(token), usedAt: null },
    data: { usedAt: new Date() },
  });
};
