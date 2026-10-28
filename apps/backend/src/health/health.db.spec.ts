// Health check tests, run against a real test database with
//   npx nx test-db backend
import { prisma } from "../lib/prisma";
import { startApi } from "../test/http";
import { checkHealth } from "./health.service";

let api: Awaited<ReturnType<typeof startApi>>;

beforeAll(async () => {
  api = await startApi();
});

afterAll(async () => {
  await api.close();
  await prisma.$disconnect();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// Keeps the expected failure logs out of the test output.
const quietErrors = () => vi.spyOn(console, "error").mockImplementation(() => undefined);

describe("GET /health", () => {
  it("answers 200 when the database is reachable, without signing in", async () => {
    const res = await api.request("GET", "/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("answers 503 when the database query fails", async () => {
    const logged = quietErrors();
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("connection refused"));

    const res = await api.request("GET", "/health");
    expect(res.status).toBe(503);
    expect(res.body.error).toEqual({
      code: "SERVICE_UNAVAILABLE",
      message: "Database unavailable",
    });
    // The cause is logged for whoever reads Railway's logs, not sent back.
    expect(JSON.stringify(res.body)).not.toContain("connection refused");
    expect(logged).toHaveBeenCalled();
  });
});

describe("checkHealth", () => {
  it("gives up on a database that doesn't answer within 3 seconds", async () => {
    quietErrors();
    vi.useFakeTimers();
    vi.spyOn(prisma, "$queryRaw").mockReturnValueOnce(
      new Promise(() => undefined) as ReturnType<typeof prisma.$queryRaw>,
    );

    const check = expect(checkHealth()).rejects.toThrow("Database unavailable");
    await vi.advanceTimersByTimeAsync(3000);
    await check;
  });
});
