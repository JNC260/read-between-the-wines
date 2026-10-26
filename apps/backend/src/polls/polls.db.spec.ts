// Poll API tests, run against a real test database with
//   npx nx test-db backend
// Each test sends HTTP requests to the real app, so they check behaviour
// (status codes, error codes, response bodies, what's saved) and not how the
// routes, controller and service split the work.
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import {
  createBook,
  createClosedPollRow,
  createMeeting,
  createPollRow,
  createUser,
  createVotes,
  inDays,
  resetDb,
} from "../test/db";
import { type ApiResponse, startApi } from "../test/http";

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
type Book = Awaited<ReturnType<typeof createBook>>;

let admin: User;
let ada: User;
let ben: User;
// Three suggested books that aren't on a meeting, so they can go on a ballot.
let circe: Book;
let piranesi: Book;
let beloved: Book;

beforeEach(async () => {
  await resetDb();
  admin = await createUser({ firstName: "Admin", isAdmin: true });
  ada = await createUser({ firstName: "Ada" });
  ben = await createUser({ firstName: "Ben" });
  circe = await createBook({ title: "Circe", suggestedBy: ada.id });
  piranesi = await createBook({ title: "Piranesi", suggestedBy: ben.id });
  beloved = await createBook({ title: "Beloved", suggestedBy: ada.id });
});

const sorted = (ids: string[]) => [...ids].sort();
const errorCode = (res: ApiResponse) => res.body?.error?.code;

const validPoll = (overrides: Record<string, unknown> = {}) => ({
  bookIds: [circe.id, piranesi.id, beloved.id],
  closesAt: inDays(7).toISOString(),
  votesPerMember: 2,
  theme: "Witchy reads",
  ...overrides,
});

const createPoll = (body: unknown, as: User = admin) =>
  api.request("POST", "/polls", { as, body });

const vote = (pollId: string, bookIds: string[], as: User = ada) =>
  api.request("PUT", `/polls/${pollId}/votes`, { as, body: { bookIds } });

const pollCount = () => prisma.poll.count();

describe("POST /polls", () => {
  it("creates an open poll and returns it with 201", async () => {
    const before = Date.now();
    const closesAt = inDays(7).toISOString();
    const res = await createPoll(validPoll({ closesAt }));
    const after = Date.now();

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      theme: "Witchy reads",
      closesAt,
      votesPerMember: 2,
      isOpen: true,
      myVotes: [],
      voterCount: 0,
      results: null,
    });
    const opensAt = new Date(res.body.opensAt).getTime();
    expect(opensAt).toBeGreaterThanOrEqual(before - 1000);
    expect(opensAt).toBeLessThanOrEqual(after + 1000);
    expect(await pollCount()).toBe(1);
  });

  it("puts every chosen book on the ballot, synopsis and Goodreads link included", async () => {
    const res = await createPoll(validPoll());
    expect(sorted(res.body.books.map((b: { id: string }) => b.id))).toEqual(
      sorted([circe.id, piranesi.id, beloved.id]),
    );
    const circeOnBallot = res.body.books.find(
      (b: { id: string }) => b.id === circe.id,
    );
    expect(circeOnBallot).toMatchObject({
      title: "Circe",
      synopsis: "What Circe is about.",
      goodreadsUrl: "https://www.goodreads.com/book/show/1",
    });
  });

  it("allows leaving out the theme", async () => {
    // JSON.stringify leaves undefined keys out.
    const res = await createPoll(validPoll({ theme: undefined }));
    expect(res.status).toBe(201);
    expect(res.body.theme).toBeNull();
  });

  it("is admins only", async () => {
    const res = await createPoll(validPoll(), ada);
    expect(res.status).toBe(403);
    expect(errorCode(res)).toBe("FORBIDDEN");
    expect(await pollCount()).toBe(0);
  });

  it("needs a signed-in user", async () => {
    const res = await api.request("POST", "/polls", { body: validPoll() });
    expect(res.status).toBe(401);
  });

  describe("rejects an invalid body with 400", () => {
    it.each([
      [
        "only one book",
        () => validPoll({ bookIds: [circe.id], votesPerMember: 1 }),
      ],
      [
        "more than six books",
        () =>
          validPoll({
            bookIds: Array.from({ length: 7 }, () => randomUUID()),
          }),
      ],
      [
        "the same book twice",
        () => validPoll({ bookIds: [circe.id, circe.id, piranesi.id] }),
      ],
      [
        "a closing time in the past",
        () => validPoll({ closesAt: inDays(-1).toISOString() }),
      ],
      ["zero votes per member", () => validPoll({ votesPerMember: 0 })],
      ["as many votes as books", () => validPoll({ votesPerMember: 3 })],
      ["a fractional vote count", () => validPoll({ votesPerMember: 1.5 })],
      ["no closing time", () => validPoll({ closesAt: undefined })],
    ])("%s", async (_, body) => {
      const res = await createPoll(body());
      expect(res.status).toBe(400);
      expect(errorCode(res)).toBe("BAD_REQUEST");
      expect(await pollCount()).toBe(0);
    });
  });

  it("allows up to six books", async () => {
    const more = await Promise.all(
      ["A", "B", "C"].map((title) =>
        createBook({ title, suggestedBy: ben.id }),
      ),
    );
    const res = await createPoll(
      validPoll({
        bookIds: [circe.id, piranesi.id, beloved.id, ...more.map((b) => b.id)],
        votesPerMember: 5,
      }),
    );
    expect(res.status).toBe(201);
    expect(res.body.books).toHaveLength(6);
    expect(res.body.votesPerMember).toBe(5);
    const saved = await prisma.poll.findUniqueOrThrow({
      where: { id: res.body.id },
    });
    expect(saved.votesPerMember).toBe(5);
  });

  describe("rejects books that can't go on a ballot with 400", () => {
    it("a book that doesn't exist", async () => {
      const res = await createPoll(
        validPoll({ bookIds: [circe.id, randomUUID()], votesPerMember: 1 }),
      );
      expect(res.status).toBe(400);
      expect(await pollCount()).toBe(0);
    });

    it("a book nobody has suggested", async () => {
      const unsuggested = await createBook({ title: "Unsuggested" });
      const res = await createPoll(
        validPoll({ bookIds: [circe.id, unsuggested.id], votesPerMember: 1 }),
      );
      expect(res.status).toBe(400);
      expect(await pollCount()).toBe(0);
    });

    it("a book that's already on a meeting", async () => {
      await createMeeting({ bookId: beloved.id });
      const res = await createPoll(validPoll());
      expect(res.status).toBe(400);
      expect(await pollCount()).toBe(0);
    });
  });

  it("refuses with 409 while another poll is open", async () => {
    await createPollRow({ bookIds: [circe.id, piranesi.id] });
    const res = await createPoll(validPoll());
    expect(res.status).toBe(409);
    expect(errorCode(res)).toBe("CONFLICT");
    expect(await pollCount()).toBe(1);
  });

  it("allows a new poll once the last one has closed, even with the same books", async () => {
    await createClosedPollRow({ bookIds: [circe.id, piranesi.id] });
    const res = await createPoll(validPoll());
    expect(res.status).toBe(201);
  });
});

describe("GET /polls/current", () => {
  it("returns null when there's no poll", async () => {
    const res = await api.request("GET", "/polls/current", { as: ada });
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it("returns null when every poll has closed", async () => {
    await createClosedPollRow({ bookIds: [circe.id, piranesi.id] });
    const res = await api.request("GET", "/polls/current", { as: ada });
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it("ignores a poll that hasn't opened yet", async () => {
    await createPollRow({
      bookIds: [circe.id, piranesi.id],
      opensAt: inDays(1),
      closesAt: inDays(8),
    });
    const res = await api.request("GET", "/polls/current", { as: ada });
    expect(res.body).toBeNull();
  });

  it("returns the open poll with this member's votes", async () => {
    await createClosedPollRow({ bookIds: [circe.id, piranesi.id] });
    const open = await createPollRow({
      bookIds: [circe.id, piranesi.id, beloved.id],
    });
    await createVotes(open.id, ada.id, [circe.id, beloved.id]);
    await createVotes(open.id, ben.id, [piranesi.id]);

    const res = await api.request("GET", "/polls/current", { as: ada });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: open.id,
      isOpen: true,
      voterCount: 2,
      results: null,
    });
    expect(sorted(res.body.myVotes)).toEqual(sorted([circe.id, beloved.id]));
  });

  it("shows an empty myVotes to a member who hasn't voted", async () => {
    const open = await createPollRow({ bookIds: [circe.id, piranesi.id] });
    await createVotes(open.id, ben.id, [piranesi.id]);
    const res = await api.request("GET", "/polls/current", { as: ada });
    expect(res.body.myVotes).toEqual([]);
    expect(res.body.voterCount).toBe(1);
  });

  it("needs a signed-in user", async () => {
    const res = await api.request("GET", "/polls/current");
    expect(res.status).toBe(401);
  });
});

describe("GET /polls/:id", () => {
  it("returns 404 for a poll that doesn't exist", async () => {
    const res = await api.request("GET", `/polls/${randomUUID()}`, { as: ada });
    expect(res.status).toBe(404);
    expect(errorCode(res)).toBe("NOT_FOUND");
  });

  it("returns an open poll with the ballot and no results, even to admins", async () => {
    const poll = await createPollRow({
      bookIds: [circe.id, piranesi.id, beloved.id],
      votesPerMember: 2,
    });
    await createVotes(poll.id, ada.id, [circe.id]);

    const res = await api.request("GET", `/polls/${poll.id}`, { as: admin });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: poll.id,
      votesPerMember: 2,
      isOpen: true,
      myVotes: [],
      voterCount: 1,
      results: null,
    });
    expect(res.body.books).toHaveLength(3);
    expect(res.body.books[0].synopsis).toEqual(expect.any(String));
  });

  it("returns a closed poll with every book's votes, most first", async () => {
    const poll = await createClosedPollRow({
      bookIds: [circe.id, piranesi.id, beloved.id],
      votesPerMember: 2,
    });
    await createVotes(poll.id, ada.id, [circe.id, piranesi.id]);
    await createVotes(poll.id, ben.id, [piranesi.id]);

    const res = await api.request("GET", `/polls/${poll.id}`, { as: ada });
    expect(res.status).toBe(200);
    expect(res.body.isOpen).toBe(false);
    expect(res.body.voterCount).toBe(2);
    expect(sorted(res.body.myVotes)).toEqual(sorted([circe.id, piranesi.id]));
    expect(res.body.results).toEqual([
      { bookId: piranesi.id, votes: 2 },
      { bookId: circe.id, votes: 1 },
      { bookId: beloved.id, votes: 0 },
    ]);
  });

  it("needs a signed-in user", async () => {
    const poll = await createPollRow({ bookIds: [circe.id, piranesi.id] });
    const res = await api.request("GET", `/polls/${poll.id}`);
    expect(res.status).toBe(401);
  });
});

describe("PUT /polls/:id/votes", () => {
  let poll: Awaited<ReturnType<typeof createPollRow>>;

  beforeEach(async () => {
    poll = await createPollRow({
      bookIds: [circe.id, piranesi.id, beloved.id],
      votesPerMember: 2,
    });
  });

  const savedVotes = async (userId: string) =>
    sorted(
      (await prisma.vote.findMany({ where: { pollId: poll.id, userId } })).map(
        (v) => v.bookId,
      ),
    );

  it("saves the votes and returns the updated poll", async () => {
    const res = await vote(poll.id, [circe.id, beloved.id]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: poll.id,
      voterCount: 1,
      results: null,
    });
    expect(sorted(res.body.myVotes)).toEqual(sorted([circe.id, beloved.id]));
    expect(await savedVotes(ada.id)).toEqual(sorted([circe.id, beloved.id]));
  });

  it("allows fewer votes than the limit", async () => {
    const res = await vote(poll.id, [piranesi.id]);
    expect(res.status).toBe(200);
    expect(res.body.myVotes).toEqual([piranesi.id]);
  });

  it("replaces this member's earlier votes completely", async () => {
    await vote(poll.id, [circe.id, beloved.id]);
    const res = await vote(poll.id, [piranesi.id]);
    expect(res.status).toBe(200);
    expect(res.body.myVotes).toEqual([piranesi.id]);
    expect(await savedVotes(ada.id)).toEqual([piranesi.id]);
  });

  it("leaves other members' votes alone", async () => {
    await createVotes(poll.id, ben.id, [circe.id, piranesi.id]);
    const res = await vote(poll.id, [beloved.id]);
    expect(res.body.voterCount).toBe(2);
    expect(await savedVotes(ben.id)).toEqual(sorted([circe.id, piranesi.id]));
  });

  it("rejects more votes than the poll allows with 400", async () => {
    const res = await vote(poll.id, [circe.id, piranesi.id, beloved.id]);
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("BAD_REQUEST");
    expect(await savedVotes(ada.id)).toEqual([]);
  });

  it("rejects a book that isn't on this ballot with 400", async () => {
    const other = await createBook({ title: "Not on it", suggestedBy: ben.id });
    const res = await vote(poll.id, [circe.id, other.id]);
    expect(res.status).toBe(400);
    expect(await savedVotes(ada.id)).toEqual([]);
  });

  it("keeps the earlier votes when a new set is rejected", async () => {
    await vote(poll.id, [circe.id]);
    const other = await createBook({ title: "Not on it", suggestedBy: ben.id });
    const res = await vote(poll.id, [piranesi.id, other.id]);
    expect(res.status).toBe(400);
    expect(await savedVotes(ada.id)).toEqual([circe.id]);
  });

  it.each([
    ["no books", []],
    ["the same book twice", "dup"],
    ["something that isn't a uuid", ["nope"]],
  ])("rejects %s with 400", async (_, bookIds) => {
    const ids =
      bookIds === "dup" ? [circe.id, circe.id] : (bookIds as string[]);
    const res = await vote(poll.id, ids);
    expect(res.status).toBe(400);
    expect(await savedVotes(ada.id)).toEqual([]);
  });

  it("refuses with 403 once the poll has closed, keeping the old votes", async () => {
    const closed = await createClosedPollRow({
      bookIds: [circe.id, piranesi.id],
    });
    await createVotes(closed.id, ada.id, [circe.id]);
    const res = await vote(closed.id, [piranesi.id]);
    expect(res.status).toBe(403);
    expect(errorCode(res)).toBe("FORBIDDEN");
    const kept = await prisma.vote.findMany({
      where: { pollId: closed.id, userId: ada.id },
    });
    expect(kept.map((v) => v.bookId)).toEqual([circe.id]);
  });

  it("refuses with 403 before the poll opens", async () => {
    const later = await createPollRow({
      bookIds: [circe.id, piranesi.id],
      opensAt: inDays(1),
      closesAt: inDays(8),
    });
    // The open poll from beforeEach would block a second open one in the
    // API, but rows can overlap here; only "not open yet" matters.
    const res = await vote(later.id, [circe.id]);
    expect(res.status).toBe(403);
  });

  it("returns 404 for a poll that doesn't exist", async () => {
    const res = await vote(randomUUID(), [circe.id]);
    expect(res.status).toBe(404);
  });

  it("needs a signed-in user", async () => {
    const res = await api.request("PUT", `/polls/${poll.id}/votes`, {
      body: { bookIds: [circe.id] },
    });
    expect(res.status).toBe(401);
    expect(await prisma.vote.count()).toBe(0);
  });
});
