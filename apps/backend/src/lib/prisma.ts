import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// One client for the whole app. It owns the connection pool, so services
// import this instead of creating their own.
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
