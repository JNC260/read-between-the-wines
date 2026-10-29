import { tmpdir } from "node:os";
import path from "node:path";
import { testDatabaseUrl } from "./test-database-url";

// Runs in each test worker before the spec is imported, so lib/prisma
// connects to the test database, never the dev one, and uploads land in a
// throwaway folder per worker, never the repo's uploads/.
process.env.DATABASE_URL = testDatabaseUrl();
process.env.UPLOAD_DIR = path.join(tmpdir(), `rbtw-test-uploads-${process.pid}`);
