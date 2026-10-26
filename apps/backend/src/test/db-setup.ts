import { testDatabaseUrl } from "./test-database-url";

// Runs in each test worker before the spec is imported, so lib/prisma
// connects to the test database, never the dev one.
process.env.DATABASE_URL = testDatabaseUrl();
