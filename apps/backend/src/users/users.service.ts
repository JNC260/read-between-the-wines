import { type CreateUserDTO, type UserDTO } from "shared";
import { prisma } from "../lib/prisma";

// The return types are the safety net: if schema.prisma and the Zod schema
// drift apart, these stop compiling.
export const getAllUsers = (): Promise<UserDTO[]> => {
  return prisma.user.findMany();
};

export const createUser = (data: CreateUserDTO): Promise<UserDTO> => {
  return prisma.user.create({ data });
};
