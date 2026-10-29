import {
  type MergeResultDTO,
  type PlaceholderDTO,
  type UpdateProfileDTO,
  type UserDTO,
} from "shared";
import { type Prisma, UserStatus } from "../../generated/prisma/client";
import { BadRequestError, ConflictError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";

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

// ---------------------------------------------------------------------------
// Placeholders
// ---------------------------------------------------------------------------

// The legacy import's placeholder addresses (placeholderEmail() in
// scripts/legacy-import/common.ts). .invalid can never be a real domain, so
// no one who signs up can have one.
const PLACEHOLDER_EMAIL = { startsWith: "placeholder+", endsWith: "@example.invalid" };
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
      where: { userId: toId, bookId: old.bookId, createdAt: { gt: old.createdAt } },
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
    where: { userId: fromId, meetingId: { notIn: rsvped.map((r) => r.meetingId) } },
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
    const placeholder = await tx.user.findUnique({ where: { id: placeholderId } });
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
