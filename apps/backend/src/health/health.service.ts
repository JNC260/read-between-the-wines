import { ServiceUnavailableError } from "../lib/errors";
import { prisma } from "../lib/prisma";

// Long enough for a slow query on a busy database, short enough that
// Railway's checker gets an answer instead of hanging on a dead connection.
const DB_TIMEOUT_MS = 3000;

// The app is healthy when it can reach Postgres. Every page needs it.
export const checkHealth = async (): Promise<void> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`No answer from the database in ${DB_TIMEOUT_MS}ms`)),
      DB_TIMEOUT_MS,
    );
  });
  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
  } catch (e) {
    // The reason goes to the logs; the response just says it's down.
    console.error("Health check failed:", e);
    throw new ServiceUnavailableError("Database unavailable");
  } finally {
    clearTimeout(timer);
  }
};
