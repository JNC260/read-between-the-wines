// Placeholder merge tests, run against a real test database with
//   npx nx test-db backend
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import {
  addSuggestion,
  createBook,
  createMeeting,
  createPollRow,
  createRating,
  createUser,
  createVotes,
  resetDb,
} from "../test/db";
import { type ApiResponse, startApi } from "../test/http";
import { claimPlaceholder } from "./users.service";

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

// Like the legacy import makes: an INACTIVE user with a .invalid address
// and no login.
const createPlaceholder = (firstName: string, lastName: string) =>
  prisma.user.create({
    data: {
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      email: `placeholder+${randomUUID()}@example.invalid`,
      status: "INACTIVE",
    },
  });

const userExists = async (id: string) =>
  (await prisma.user.count({ where: { id } })) === 1;

const suggestionsOf = async (userId: string) =>
  (await prisma.suggestion.findMany({ where: { userId } }))
    .map((s) => s.bookId)
    .sort();

const errorCode = (res: ApiResponse) => res.body?.error?.code;

let admin: User;
let haylie: User;
let placeholder: User;

beforeEach(async () => {
  await resetDb();
  admin = await createUser({ firstName: "Admin", isAdmin: true });
  haylie = await createUser({ firstName: "Haylie" }); // Haylie Reader
  placeholder = await createPlaceholder("Haylie", "Reader");
});

describe("GET /users/placeholders", () => {
  it("lists placeholders by name with their suggestion counts", async () => {
    await createPlaceholder("Beth", "Smith");
    await createBook({ suggestedBy: placeholder.id });
    await createBook({ suggestedBy: placeholder.id });

    const res = await api.request("GET", "/users/placeholders", { as: admin });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: expect.any(String), firstName: "Beth", lastName: "Smith", suggestionCount: 0 },
      { id: placeholder.id, firstName: "Haylie", lastName: "Reader", suggestionCount: 2 },
    ]);
  });

  it("is admin-only", async () => {
    const res = await api.request("GET", "/users/placeholders", { as: haylie });
    expect(res.status).toBe(403);
  });
});

describe("POST /users/placeholders/:id/merge", () => {
  const merge = (memberId: unknown, id = placeholder.id, as = admin) =>
    api.request("POST", `/users/placeholders/${id}/merge`, {
      as,
      body: { memberId },
    });

  it("moves suggestions, ratings, RSVPs and votes, then deletes the placeholder", async () => {
    const book = await createBook({ suggestedBy: placeholder.id });
    await createRating(placeholder.id, book.id, 4);
    const meeting = await createMeeting({ bookId: book.id });
    await prisma.rsvp.create({
      data: { userId: placeholder.id, meetingId: meeting.id, status: "YES" },
    });
    const poll = await createPollRow({ bookIds: [book.id] });
    await createVotes(poll.id, placeholder.id, [book.id]);

    const res = await merge(haylie.id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ suggestions: 1, ratings: 1, rsvps: 1, votes: 1 });

    expect(await suggestionsOf(haylie.id)).toEqual([book.id]);
    expect(await prisma.rating.count({ where: { userId: haylie.id } })).toBe(1);
    expect(await prisma.rsvp.count({ where: { userId: haylie.id } })).toBe(1);
    expect(await prisma.vote.count({ where: { userId: haylie.id } })).toBe(1);
    expect(await userExists(placeholder.id)).toBe(false);
  });

  it("drops what the member already has, keeping the earlier suggestion date", async () => {
    const shared = await createBook({ suggestedBy: haylie.id });
    const legacyDate = new Date("2019-03-01T00:00:00Z");
    await addSuggestion(placeholder.id, shared.id, legacyDate);
    const onlyLegacy = await createBook({ suggestedBy: placeholder.id });
    await createRating(haylie.id, shared.id, 5);
    await createRating(placeholder.id, shared.id, 2);

    const res = await merge(haylie.id);
    expect(res.body).toEqual({ suggestions: 1, ratings: 0, rsvps: 0, votes: 0 });

    expect(await suggestionsOf(haylie.id)).toEqual([shared.id, onlyLegacy.id].sort());
    const kept = await prisma.suggestion.findUniqueOrThrow({
      where: { userId_bookId: { userId: haylie.id, bookId: shared.id } },
    });
    expect(kept.createdAt).toEqual(legacyDate);
    // Her own rating wins over the placeholder's.
    const rating = await prisma.rating.findUniqueOrThrow({
      where: { userId_bookId: { userId: haylie.id, bookId: shared.id } },
    });
    expect(rating.score).toBe(5);
    expect(await userExists(placeholder.id)).toBe(false);
  });

  it("keeps votes the member cast in another poll", async () => {
    const book = await createBook();
    const pollA = await createPollRow({ bookIds: [book.id] });
    const pollB = await createPollRow({ bookIds: [book.id] });
    await createVotes(pollA.id, haylie.id, [book.id]);
    await createVotes(pollA.id, placeholder.id, [book.id]);
    await createVotes(pollB.id, placeholder.id, [book.id]);

    const res = await merge(haylie.id);
    expect(res.body.votes).toBe(1);
    expect(await prisma.vote.count({ where: { userId: haylie.id } })).toBe(2);
  });

  it("won't merge into another placeholder", async () => {
    const other = await createPlaceholder("Haylie", "Other");
    const res = await merge(other.id);
    expect(res.status).toBe(400);
    expect(await userExists(placeholder.id)).toBe(true);
  });

  it("returns 404 for a real member's id in place of a placeholder's", async () => {
    const res = await merge(admin.id, haylie.id);
    expect(res.status).toBe(404);
    expect(await userExists(haylie.id)).toBe(true);
  });

  it("returns 404 for an unknown member", async () => {
    const res = await merge(randomUUID());
    expect(res.status).toBe(404);
    expect(await userExists(placeholder.id)).toBe(true);
  });

  it("returns 400 without a member id", async () => {
    const res = await merge("not-an-id");
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("BAD_REQUEST");
  });

  it("is admin-only", async () => {
    const res = await merge(haylie.id, placeholder.id, haylie);
    expect(res.status).toBe(403);
    expect(await userExists(placeholder.id)).toBe(true);
  });
});

describe("claimPlaceholder", () => {
  it("merges the one placeholder with the member's name, ignoring case", async () => {
    await prisma.user.update({
      where: { id: placeholder.id },
      data: { firstName: "HAYLIE", lastName: "reader" },
    });
    const book = await createBook({ suggestedBy: placeholder.id });

    expect(await claimPlaceholder(haylie.id)).toMatchObject({ suggestions: 1 });
    expect(await suggestionsOf(haylie.id)).toEqual([book.id]);
    expect(await userExists(placeholder.id)).toBe(false);
  });

  it("leaves two placeholders with the same name for an admin", async () => {
    await createPlaceholder("Haylie", "Reader");
    expect(await claimPlaceholder(haylie.id)).toBeNull();
    expect(await prisma.user.count({ where: { firstName: "Haylie" } })).toBe(3);
  });

  it("does nothing when no placeholder has the name", async () => {
    const grace = await createUser({ firstName: "Grace" });
    expect(await claimPlaceholder(grace.id)).toBeNull();
    expect(await userExists(placeholder.id)).toBe(true);
  });
});
