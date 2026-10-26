import dotenv from "dotenv";
import path from "node:path";

dotenv.config({
  path: path.resolve(import.meta.dirname, "../../../../.env"),
  quiet: true,
});

// The dev database with "_test" on the end, so tests can wipe it freely.
// Set TEST_DATABASE_URL to point somewhere else.
export const testDatabaseUrl = (): string => {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `${url.pathname}_test`;
  return url.toString();
};
