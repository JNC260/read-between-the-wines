import { type UserDTO } from "shared";
import { prisma } from "../lib/prisma";

export const getAllUsers = (): Promise<UserDTO[]> => {
  return prisma.user.findMany();
};
