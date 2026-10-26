import { execSync } from "node:child_process";
import path from "node:path";
import { testDatabaseUrl } from "./test-database-url";

// Runs once before the database specs. migrate deploy creates the test
// database if it's missing and applies any new migrations.
export default function setup() {
  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(import.meta.dirname, "../.."),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: "inherit",
  });
}
