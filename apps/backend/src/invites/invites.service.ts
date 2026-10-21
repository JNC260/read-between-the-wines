import { createHash, randomBytes } from "node:crypto";
import { type InviteDTO } from "shared";
import { sendEmail } from "../lib/email";
import { ConflictError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";

const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

// Tokens are 32 random bytes, so a fast hash is enough. Slow hashes like
// bcrypt are for passwords, which are guessable.
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

// Creates an invite without emailing it. Returns the raw token, which isn't
// stored anywhere; the caller has to deliver it.
export const createInvite = async (
  rawEmail: string,
  invitedById: string | null,
): Promise<{ invite: InviteDTO; token: string }> => {
  const email = rawEmail.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new ConflictError("That email already belongs to a member");
  }

  // Re-inviting someone replaces their old link, so only the newest works.
  await prisma.invite.deleteMany({ where: { email, usedAt: null } });

  const token = randomBytes(32).toString("base64url");
  const invite = await prisma.invite.create({
    data: {
      email,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITE_LIFETIME_MS),
      invitedById,
    },
  });
  return { invite, token };
};

// Creates the invite and emails the sign-up link. Awaited, unlike auth
// emails: the admin should see an error if it didn't send, and can just
// invite again.
export const inviteMember = async (
  email: string,
  invitedById: string,
): Promise<InviteDTO> => {
  const appUrl = process.env.BETTER_AUTH_URL;
  if (!appUrl) {
    throw new Error("BETTER_AUTH_URL is not set");
  }
  const { invite, token } = await createInvite(email, invitedById);
  const url = `${appUrl}/sign-up?invite=${token}`;
  await sendEmail({
    to: invite.email,
    subject: "You're invited to Read Between the Wines",
    html: `<p>You've been invited to join our book club! <a href="${url}">Create your account</a>.</p><p>This link expires in 7 days.</p>`,
  });
  return invite;
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

// Used by the sign-up hook in lib/auth.ts. The token proves the person can
// read that inbox, and the email must match exactly, so an invite can't be
// used to sign up as someone else.
export const isInviteValid = async (
  token: string,
  email: string,
): Promise<boolean> => {
  const invite = await prisma.invite.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  return (
    !!invite &&
    !invite.usedAt &&
    invite.expiresAt > new Date() &&
    invite.email === email.toLowerCase()
  );
};

export const markInviteUsed = async (token: string): Promise<void> => {
  await prisma.invite.updateMany({
    where: { tokenHash: hashToken(token), usedAt: null },
    data: { usedAt: new Date() },
  });
};
