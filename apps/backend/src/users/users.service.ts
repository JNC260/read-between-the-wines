import { type UserDTO } from "shared";
import { UserStatus } from "../../generated/prisma/client";
import { ConflictError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";

export const getAllUsers = (): Promise<UserDTO[]> => {
  return prisma.user.findMany();
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
