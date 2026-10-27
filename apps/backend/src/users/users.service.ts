import { type UpdateProfileDTO, type UserDTO } from "shared";
import { UserStatus } from "../../generated/prisma/client";
import { ConflictError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { type UploadedImage } from "../lib/storage";

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

// Saves the new image, points User.image at it, then deletes the old one.
export const updateProfileImage = async (
  _id: string,
  _image: UploadedImage,
): Promise<UserDTO> => {
  // TODO: saveImage(), update the user, then deleteImage() the old URL.
  // Think about the order: what's left behind if the update fails after
  // the save, or the delete fails after the update?
  throw new Error("TODO: updateProfileImage");
};

// Clears User.image and deletes the file.
export const removeProfileImage = async (_id: string): Promise<UserDTO> => {
  // TODO
  throw new Error("TODO: removeProfileImage");
};
