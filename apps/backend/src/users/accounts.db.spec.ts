// Admin tools for accounts: the full list, banning and lifting a ban, admin,
// and merging a member's two accounts. Run
// against a real test database with
//   npx nx test-db backend
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import {
  createBook,
  createMeeting,
  createPollRow,
  createRating,
  createUser,
  createVotes,
  resetDb,
} from "../test/db";
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

describe("POST /users/:id/merge", () => {
  const merge = (id: string, keepId: unknown, as: User = admin) =>
    api.request("POST", `/users/${id}/merge`, { as, body: { keepId } });

  let duplicate: User;

  beforeEach(async () => {
    duplicate = await createUser({ firstName: "Ada" });
  });

  it("moves everything to the kept account, then deletes the duplicate", async () => {
    const book = await createBook({ suggestedBy: duplicate.id });
    await createRating(duplicate.id, book.id, 4);
    const meeting = await createMeeting({ bookId: book.id });
    await prisma.rsvp.create({
      data: { userId: duplicate.id, meetingId: meeting.id, status: "YES" },
    });
    const poll = await createPollRow({ bookIds: [book.id] });
    await createVotes(poll.id, duplicate.id, [book.id]);
    const invite = await prisma.invite.create({
      data: { tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60_000), invitedById: duplicate.id },
    });
    await signIn(duplicate.id);
    await prisma.account.create({
      data: { accountId: duplicate.id, providerId: "credential", userId: duplicate.id },
    });

    const res = await merge(duplicate.id, ada.id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ suggestions: 1, ratings: 1, rsvps: 1, votes: 1 });

    expect(await prisma.suggestion.count({ where: { userId: ada.id } })).toBe(1);
    expect(await prisma.rating.count({ where: { userId: ada.id } })).toBe(1);
    expect(await prisma.rsvp.count({ where: { userId: ada.id } })).toBe(1);
    expect(await prisma.vote.count({ where: { userId: ada.id } })).toBe(1);
    expect((await prisma.invite.findUniqueOrThrow({ where: { id: invite.id } })).invitedById).toBe(ada.id);
    expect(await prisma.user.findUnique({ where: { id: duplicate.id } })).toBeNull();
    expect(await prisma.session.count({ where: { userId: duplicate.id } })).toBe(0);
    expect(await prisma.account.count({ where: { userId: duplicate.id } })).toBe(0);
  });

  it("fills in profile details the kept account is missing, and keeps the earlier year", async () => {
    await prisma.user.update({
      where: { id: ada.id },
      data: { phone: "+15550000001", memberSince: 2021 },
    });
    await prisma.user.update({
      where: { id: duplicate.id },
      data: {
        phone: "+15550000002",
        instagram: "ada.reads",
        image: "/uploads/ada.webp",
        memberSince: 2018,
      },
    });

    await merge(duplicate.id, ada.id);
    const kept = await prisma.user.findUniqueOrThrow({ where: { id: ada.id } });
    expect(kept.phone).toBe("+15550000001");
    expect(kept.instagram).toBe("ada.reads");
    expect(kept.image).toBe("/uploads/ada.webp");
    expect(kept.memberSince).toBe(2018);
  });

  it("keeps the kept account's ballot in a poll both voted in", async () => {
    const [a, b, c] = await Promise.all([createBook(), createBook(), createBook()]);
    const poll = await createPollRow({ bookIds: [a.id, b.id, c.id] });
    const other = await createPollRow({ bookIds: [a.id, b.id, c.id] });
    await createVotes(poll.id, ada.id, [a.id, b.id]);
    await createVotes(poll.id, duplicate.id, [b.id, c.id]);
    await createVotes(other.id, duplicate.id, [c.id]);

    const res = await merge(duplicate.id, ada.id);
    expect(res.body.votes).toBe(1);
    const votes = await prisma.vote.findMany({ where: { userId: ada.id, pollId: poll.id } });
    expect(votes.map((v) => v.bookId).sort()).toEqual([a.id, b.id].sort());
    expect(await prisma.vote.count({ where: { userId: ada.id, pollId: other.id } })).toBe(1);
  });

  it.each([
    ["into itself", () => [duplicate.id, duplicate.id], 400],
    ["your own account away", () => [admin.id, ada.id], 400],
    ["into an unknown account", () => [duplicate.id, randomUUID()], 404],
    ["an unknown account", () => [randomUUID(), ada.id], 404],
  ])("won't merge %s", async (_, ids, status) => {
    const [id, keepId] = ids();
    expect((await merge(id, keepId)).status).toBe(status);
  });

  it("won't merge away an admin, or into an account that isn't active", async () => {
    await prisma.user.update({ where: { id: duplicate.id }, data: { isAdmin: true } });
    expect((await merge(duplicate.id, ada.id)).body.error.message).toBe("Remove their admin first");
    await prisma.user.update({ where: { id: duplicate.id }, data: { isAdmin: false } });
    await prisma.user.update({ where: { id: ada.id }, data: { status: "BANNED" } });
    expect((await merge(duplicate.id, ada.id)).status).toBe(400);
    expect(await prisma.user.findUnique({ where: { id: duplicate.id } })).not.toBeNull();
  });

  it("checks the body, and is for admins only", async () => {
    expect((await merge(duplicate.id, "nope")).status).toBe(400);
    expect((await merge(duplicate.id, ada.id, ada)).status).toBe(403);
  });
});
