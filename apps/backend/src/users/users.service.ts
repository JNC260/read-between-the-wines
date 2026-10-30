import {
  type EmailSettingsDTO,
  type MergeResultDTO,
  type PlaceholderDTO,
  type UpdateProfileDTO,
  type UserDTO,
} from "shared";
import { type Prisma, UserStatus } from "../../generated/prisma/client";
import { BadRequestError, ConflictError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { toProfileImage } from "../lib/images";
import { deleteImage, saveImage, type UploadedImage } from "../lib/storage";

// The member list. Inactive and banned accounts have left the club, so
// they're left out, along with their contact details.
export const getActiveUsers = (): Promise<UserDTO[]> => {
  return prisma.user.findMany({
    where: { status: UserStatus.ACTIVE },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
};

// Members can deactivate themselves and admins can deactivate anyone. Either
// way the member can reactivate later; it's a courtesy, not a security
// measure. Only ACTIVE accounts change, so a banned user can't be deactivated
// and then reactivate their way out of the ban.
const changeStatus = async (
  id: string,
  from: UserStatus,
  to: UserStatus,
): Promise<UserDTO> => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError("User not found");
  }
  if (user.status !== from) {
    throw new ConflictError(`Account is ${user.status.toLowerCase()}`);
  }
  return prisma.user.update({ where: { id }, data: { status: to } });
};

export const deactivateUser = (id: string): Promise<UserDTO> =>
  changeStatus(id, UserStatus.ACTIVE, UserStatus.INACTIVE);

export const reactivateUser = (id: string): Promise<UserDTO> =>
  changeStatus(id, UserStatus.INACTIVE, UserStatus.ACTIVE);

// Admins only (the routes check). Every real account, whatever its status,
// for the manage members page. Legacy placeholders have their own page.
export const listAccounts = (): Promise<UserDTO[]> =>
  prisma.user.findMany({
    where: { NOT: { email: PLACEHOLDER_EMAIL } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

// A ban is the security measure deactivating isn't: the member is signed out
// everywhere and can't sign in or reactivate. Their suggestions, ratings and
// RSVPs stay. Admins can't ban themselves or another admin.
export const banUser = async (adminId: string, id: string): Promise<UserDTO> => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || isPlaceholderEmail(user.email)) {
    throw new NotFoundError("User not found");
  }
  if (user.id === adminId) {
    throw new BadRequestError("You can't ban yourself");
  }
  if (user.isAdmin) {
    throw new BadRequestError("Admins can't be banned");
  }
  if (user.status === UserStatus.BANNED) {
    throw new ConflictError("Account is banned");
  }
  const [banned] = await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { status: UserStatus.BANNED } }),
    prisma.session.deleteMany({ where: { userId: id } }),
  ]);
  return banned;
};

// Admins only. Only active members can be made admins. An admin can't drop
// their own admin, which also means the club always keeps at least one:
// whoever removes an admin is one, and stays one.
export const setAdmin = async (
  adminId: string,
  id: string,
  isAdmin: boolean,
): Promise<UserDTO> => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || isPlaceholderEmail(user.email)) {
    throw new NotFoundError("User not found");
  }
  if (user.isAdmin === isAdmin) {
    throw new ConflictError(isAdmin ? "Already an admin" : "Not an admin");
  }
  if (isAdmin && user.status !== UserStatus.ACTIVE) {
    throw new BadRequestError(`Account is ${user.status.toLowerCase()}`);
  }
  if (!isAdmin && user.id === adminId) {
    throw new BadRequestError("You can't remove your own admin");
  }
  return prisma.user.update({ where: { id }, data: { isAdmin } });
};

// Lifting a ban makes the account active again, so they can sign straight in.
export const unbanUser = (id: string): Promise<UserDTO> =>
  changeStatus(id, UserStatus.BANNED, UserStatus.ACTIVE);

export const getEmailSettings = async (id: string): Promise<EmailSettingsDTO> =>
  prisma.user.findUniqueOrThrow({ where: { id }, select: { emailOptOuts: true } });

export const updateEmailSettings = (
  id: string,
  { emailOptOuts }: EmailSettingsDTO,
): Promise<EmailSettingsDTO> =>
  prisma.user.update({ where: { id }, data: { emailOptOuts }, select: { emailOptOuts: true } });

// name is Better Auth's display name. Sign-up sets it to "First Last", so it
// follows any change to either half.
export const updateProfile = async (
  id: string,
  data: UpdateProfileDTO,
): Promise<UserDTO> => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError("User not found");
  }
  const firstName = data.firstName ?? user.firstName;
  const lastName = data.lastName ?? user.lastName;
  return prisma.user.update({
    where: { id },
    data: { ...data, name: `${firstName} ${lastName}` },
  });
};

const findUser = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError("User not found");
  }
  return user;
};

// Saves the new image, points User.image at it, then deletes the old one.
// The order means a failure never leaves User.image pointing at a missing
// file; the worst case is a stray file on disk:
//   - not an image: toProfileImage throws a 400 before anything is saved
//   - the update fails: the new file is deleted, the old photo stays
//   - deleting the old file fails: deleteImage logs it; the new photo is
//     already live, so the request still succeeds
export const updateProfileImage = async (
  id: string,
  image: UploadedImage,
): Promise<UserDTO> => {
  const user = await findUser(id);
  const url = await saveImage(await toProfileImage(image.buffer));
  let updated;
  try {
    updated = await prisma.user.update({ where: { id }, data: { image: url } });
  } catch (err) {
    await deleteImage(url);
    throw err;
  }
  if (user.image) {
    await deleteImage(user.image);
  }
  return updated;
};

// Clears User.image and deletes the file, in that order for the same
// reason. Removing a photo that isn't there is fine: the result is the same.
export const removeProfileImage = async (id: string): Promise<UserDTO> => {
  const user = await findUser(id);
  if (!user.image) {
    return user;
  }
  const updated = await prisma.user.update({
    where: { id },
    data: { image: null },
  });
  await deleteImage(user.image);
  return updated;
};
// ---------------------------------------------------------------------------
// Placeholders
// ---------------------------------------------------------------------------

// The legacy import's placeholder addresses (placeholderEmail() in
// scripts/legacy-import/common.ts). .invalid can never be a real domain, so
// no one who signs up can have one.
const PLACEHOLDER_EMAIL = {
  startsWith: "placeholder+",
  endsWith: "@example.invalid",
};
const isPlaceholderEmail = (email: string) =>
  email.startsWith(PLACEHOLDER_EMAIL.startsWith) &&
  email.endsWith(PLACEHOLDER_EMAIL.endsWith);

export const listPlaceholders = async (): Promise<PlaceholderDTO[]> => {
  const users = await prisma.user.findMany({
    where: { email: PLACEHOLDER_EMAIL },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    include: { _count: { select: { suggestions: true } } },
  });
  return users.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    suggestionCount: u._count.suggestions,
  }));
};

type Tx = Prisma.TransactionClient;

// Each of these tables is keyed by user plus something else, so a row the
// member already has (they re-suggested a legacy book, say) can't move over.
// Those are dropped; everything else changes hands.
const moveRows = async (
  tx: Tx,
  fromId: string,
  toId: string,
): Promise<MergeResultDTO> => {
  const theirs = { userId: toId };

  const suggested = await tx.suggestion.findMany({ where: theirs });
  const suggestedBooks = suggested.map((s) => s.bookId);
  // A shared suggestion keeps the earlier date, which for a legacy book is
  // when it was really first suggested.
  const legacyDates = await tx.suggestion.findMany({
    where: { userId: fromId, bookId: { in: suggestedBooks } },
  });
  for (const old of legacyDates) {
    await tx.suggestion.updateMany({
      where: {
        userId: toId,
        bookId: old.bookId,
        createdAt: { gt: old.createdAt },
      },
      data: { createdAt: old.createdAt },
    });
  }
  const suggestions = await tx.suggestion.updateMany({
    where: { userId: fromId, bookId: { notIn: suggestedBooks } },
    data: { userId: toId },
  });

  const rated = await tx.rating.findMany({ where: theirs });
  const ratings = await tx.rating.updateMany({
    where: { userId: fromId, bookId: { notIn: rated.map((r) => r.bookId) } },
    data: { userId: toId },
  });

  const rsvped = await tx.rsvp.findMany({ where: theirs });
  const rsvps = await tx.rsvp.updateMany({
    where: {
      userId: fromId,
      meetingId: { notIn: rsvped.map((r) => r.meetingId) },
    },
    data: { userId: toId },
  });

  const voted = await tx.vote.findMany({ where: theirs });
  const votes = await tx.vote.updateMany({
    where: {
      userId: fromId,
      ...(voted.length > 0 && {
        NOT: voted.map((v) => ({ pollId: v.pollId, bookId: v.bookId })),
      }),
    },
    data: { userId: toId },
  });

  // What's left are the duplicates.
  const leftovers = { where: { userId: fromId } };
  await tx.suggestion.deleteMany(leftovers);
  await tx.rating.deleteMany(leftovers);
  await tx.rsvp.deleteMany(leftovers);
  await tx.vote.deleteMany(leftovers);

  return {
    suggestions: suggestions.count,
    ratings: ratings.count,
    rsvps: rsvps.count,
    votes: votes.count,
  };
};

// Gives a placeholder's suggestions, ratings, RSVPs and votes to a real
// member, then deletes the placeholder. All or nothing.
export const mergePlaceholder = (
  placeholderId: string,
  memberId: string,
): Promise<MergeResultDTO> =>
  prisma.$transaction(async (tx) => {
    const placeholder = await tx.user.findUnique({
      where: { id: placeholderId },
    });
    if (!placeholder || !isPlaceholderEmail(placeholder.email)) {
      throw new NotFoundError("Placeholder not found");
    }
    const member = await tx.user.findUnique({ where: { id: memberId } });
    if (!member) {
      throw new NotFoundError("Member not found");
    }
    if (isPlaceholderEmail(member.email)) {
      throw new BadRequestError("Pick a member who has joined the site");
    }
    const moved = await moveRows(tx, placeholder.id, member.id);
    await tx.user.delete({ where: { id: placeholder.id } });
    return moved;
  });

// Called once a new member verifies their email. If exactly one placeholder
// has their first and last name, it was them, so its history becomes theirs.
// Anything less certain (no match, two of the same name, a nickname) is left
// for an admin to merge by hand.
export const claimPlaceholder = async (
  memberId: string,
): Promise<MergeResultDTO | null> => {
  const member = await prisma.user.findUnique({ where: { id: memberId } });
  if (!member || isPlaceholderEmail(member.email)) {
    return null;
  }
  const matches = await prisma.user.findMany({
    where: {
      email: PLACEHOLDER_EMAIL,
      firstName: { equals: member.firstName.trim(), mode: "insensitive" },
      lastName: { equals: member.lastName.trim(), mode: "insensitive" },
    },
  });
  if (matches.length !== 1) {
    return null;
  }
  return mergePlaceholder(matches[0].id, member.id);
};
