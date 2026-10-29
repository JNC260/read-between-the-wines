import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { config } from "./config";

// One client for the whole app. It owns the connection pool, so services
// import this instead of creating their own.
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: config.DATABASE_URL }),
});
