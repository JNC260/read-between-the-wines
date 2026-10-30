// Admin view of invite links. Run against a real test database with
//   npx nx test-db backend
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { createUser, resetDb } from "../test/db";
import { startApi } from "../test/http";

vi.mock("../middleware/auth", () => import("../test/mock-auth"));

let api: Awaited<ReturnType<typeof startApi>>;

beforeAll(async () => {
  api = await startApi();
});

afterAll(async () => {
  await api.close();
  await prisma.$disconnect();
});

type User = Awaited<ReturnType<typeof createUser>>;

let admin: User;
let ada: User;

beforeEach(async () => {
  await resetDb();
  admin = await createUser({ firstName: "Admin", isAdmin: true });
  ada = await createUser({ firstName: "Ada" });
});

const DAY = 24 * 60 * 60 * 1000;
const invite = (data: { invitedById?: string | null; usedAt?: Date; expiresInDays?: number; createdAt?: Date }) =>
  prisma.invite.create({
    data: {
      tokenHash: randomUUID(),
      expiresAt: new Date(Date.now() + (data.expiresInDays ?? 7) * DAY),
      usedAt: data.usedAt,
      invitedById: data.invitedById ?? null,
      createdAt: data.createdAt,
    },
  });

describe("GET /invites", () => {
  it("lists unused links that still work, newest first, with who made them", async () => {
    const older = await invite({ invitedById: ada.id, createdAt: new Date(Date.now() - DAY) });
    const newer = await invite({ invitedById: null });
    await invite({ invitedById: ada.id, usedAt: new Date() });
    await invite({ invitedById: ada.id, expiresInDays: -1 });

    const res = await api.request("GET", "/invites", { as: admin });
    expect(res.status).toBe(200);
    expect(res.body.map((i: { id: string }) => i.id)).toEqual([newer.id, older.id]);
    expect(res.body[1].invitedBy).toEqual({ firstName: "Ada", lastName: "Reader" });
    expect(res.body[0].invitedBy).toBeNull();
    // Only a hash is stored, so the link itself is never sent back.
    expect(res.body[0]).not.toHaveProperty("url");
    expect(res.body[0]).not.toHaveProperty("tokenHash");
  });

  it("is for admins only", async () => {
    expect((await api.request("GET", "/invites", { as: ada })).status).toBe(403);
  });
});

describe("DELETE /invites/:id", () => {
  it("revokes an unused link", async () => {
    const link = await invite({ invitedById: ada.id });
    const res = await api.request("DELETE", `/invites/${link.id}`, { as: admin });
    expect(res.status).toBe(204);
    expect(await prisma.invite.count()).toBe(0);
  });
});
