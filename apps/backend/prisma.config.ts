import path from "node:path";
import { defineConfig } from "prisma/config";

// Locally, read the root .env. Node's own loader, not dotenv, because this
// file also runs in the production image for `prisma migrate deploy`, where
// dev dependencies aren't installed. It never overrides a variable that's
// already set, and in production there's no .env file at all: Railway
// provides DATABASE_URL directly.
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, "../../.env"));
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
    throw e;
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Not env("DATABASE_URL"), which throws when it's unset: `prisma generate`
  // runs in the Docker build, where there's no database. Migrate commands
  // still refuse to run without a URL.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
