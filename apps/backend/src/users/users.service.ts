import { prisma } from "../lib/prisma";

export const getAllUsers = () => {
  return prisma.user.findMany();
};
