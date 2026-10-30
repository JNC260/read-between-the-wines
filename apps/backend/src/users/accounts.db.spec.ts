// Admin tools for accounts: the full list, banning and lifting a ban. Run
// against a real test database with
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

const ban = (id: string, as: User = admin) =>
  api.request("POST", `/users/${id}/ban`, { as });
const unban = (id: string, as: User = admin) =>
  api.request("POST", `/users/${id}/unban`, { as });

const signIn = (userId: string) =>
  prisma.session.create({
    data: { userId, token: randomUUID(), expiresAt: new Date(Date.now() + 60_000) },
  });

describe("GET /users/accounts", () => {
  it("lists every account with its status, but not legacy placeholders", async () => {
    const grace = await createUser({ firstName: "Grace" });
    await prisma.user.update({ where: { id: grace.id }, data: { status: "BANNED" } });
    await prisma.user.create({
      data: {
        name: "Old Member",
        firstName: "Old",
        lastName: "Member",
        email: "placeholder+old@example.invalid",
        status: "INACTIVE",
      },
    });

    const res = await api.request("GET", "/users/accounts", { as: admin });
    expect(res.status).toBe(200);
    expect(res.body.map((u: { firstName: string; status: string }) => [u.firstName, u.status])).toEqual([
      ["Ada", "ACTIVE"],
      ["Admin", "ACTIVE"],
      ["Grace", "BANNED"],
    ]);
  });

  it("is for admins only", async () => {
    expect((await api.request("GET", "/users/accounts", { as: ada })).status).toBe(403);
  });
});

describe("POST /users/:id/ban", () => {
  it("bans the member and signs them out everywhere", async () => {
    await signIn(ada.id);
    await signIn(ada.id);
    const res = await ban(ada.id);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("BANNED");
    expect(await prisma.session.count({ where: { userId: ada.id } })).toBe(0);
  });

  it("bans an inactive member too, so they can't reactivate", async () => {
    await prisma.user.update({ where: { id: ada.id }, data: { status: "INACTIVE" } });
    expect((await ban(ada.id)).body.status).toBe("BANNED");
    const reactivate = await api.request("POST", "/users/me/reactivate", { as: ada });
    expect(reactivate.status).toBe(409);
  });

  it("leaves other members signed in", async () => {
    await signIn(admin.id);
    await ban(ada.id);
    expect(await prisma.session.count({ where: { userId: admin.id } })).toBe(1);
  });

  it.each([
    ["yourself", () => admin.id, 400],
    ["another admin", async () => (await createUser({ isAdmin: true })).id, 400],
    ["an unknown account", () => randomUUID(), 404],
  ])("won't ban %s", async (_, id, status) => {
    expect((await ban(await id())).status).toBe(status);
  });

  it("returns 409 when they're already banned, and 403 for members", async () => {
    await ban(ada.id);
    expect((await ban(ada.id)).status).toBe(409);
    const grace = await createUser({ firstName: "Grace" });
    expect((await ban(grace.id, ada)).status).toBe(403);
  });
});

describe("POST /users/:id/unban", () => {
  it("makes a banned member active again", async () => {
    await ban(ada.id);
    const res = await unban(ada.id);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ACTIVE");
  });

  it("returns 409 for someone who isn't banned, and 403 for members", async () => {
    expect((await unban(ada.id)).status).toBe(409);
    await ban(ada.id);
    const grace = await createUser({ firstName: "Grace" });
    expect((await unban(ada.id, grace)).status).toBe(403);
  });
});

describe("PUT and DELETE /users/:id/admin", () => {
  const makeAdmin = (id: string, as: User = admin) =>
    api.request("PUT", `/users/${id}/admin`, { as });
  const removeAdmin = (id: string, as: User = admin) =>
    api.request("DELETE", `/users/${id}/admin`, { as });

  it("makes a member an admin, and takes it away again", async () => {
    const made = await makeAdmin(ada.id);
    expect(made.status).toBe(200);
    expect(made.body.isAdmin).toBe(true);
    // Now an admin, Ada can use admin tools.
    expect((await api.request("GET", "/users/accounts", { as: ada })).status).toBe(200);

    const removed = await removeAdmin(ada.id);
    expect(removed.body.isAdmin).toBe(false);
    expect((await api.request("GET", "/users/accounts", { as: ada })).status).toBe(403);
  });

  it("won't make an inactive or banned member an admin", async () => {
    await prisma.user.update({ where: { id: ada.id }, data: { status: "BANNED" } });
    expect((await makeAdmin(ada.id)).status).toBe(400);
  });

  it("won't let an admin remove their own admin", async () => {
    await makeAdmin(ada.id);
    const res = await removeAdmin(admin.id);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("You can't remove your own admin");
  });

  it("returns 409 when nothing would change, 403 for members, 404 for unknown accounts", async () => {
    expect((await removeAdmin(ada.id)).status).toBe(409);
    await makeAdmin(ada.id);
    expect((await makeAdmin(ada.id)).status).toBe(409);
    const grace = await createUser({ firstName: "Grace" });
    expect((await makeAdmin(grace.id, grace)).status).toBe(403);
    expect((await makeAdmin(randomUUID())).status).toBe(404);
  });
});
