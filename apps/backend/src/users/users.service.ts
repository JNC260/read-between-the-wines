import { type CreateUserDTO, type UserDTO } from "shared";
import { Prisma } from "../../generated/prisma/client";
import { ConflictError } from "../lib/errors";
import { prisma } from "../lib/prisma";

export const getAllUsers = (): Promise<UserDTO[]> => {
  return prisma.user.findMany();
};

export const createUser = async (data: CreateUserDTO): Promise<UserDTO> => {
  try {
    return await prisma.user.create({ data });
  } catch (err) {
    // P2002: unique constraint failed. email is the only unique field on User.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new ConflictError("You already have an account");
    }
    throw err;
  }
};
