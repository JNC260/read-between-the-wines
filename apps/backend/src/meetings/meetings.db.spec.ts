// Meeting API tests, run against a real test database with
//   npx nx test-db backend
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import {
  createBook,
  createMeeting,
  createUser,
  createVenue,
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

let admin: User;
let ada: User;

beforeEach(async () => {
  await resetDb();
  admin = await createUser({ firstName: "Admin", isAdmin: true });
  ada = await createUser({ firstName: "Ada" });
});

const HOUR = 60 * 60 * 1000;
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * HOUR);

const errorCode = (res: ApiResponse) => res.body?.error?.code;
const titles = (res: ApiResponse) =>
  res.body.map((m: { title: string }) => m.title);

const validMeeting = (overrides: Record<string, unknown> = {}) => ({
  title: "November meeting",
  start: "2026-11-20T19:00:00.000Z",
  end: "2026-11-20T21:00:00.000Z",
  ...overrides,
});

describe("GET /meetings", () => {
  const list = (query = "") =>
    api.request("GET", `/meetings${query}`, { as: ada });

  // One finished, one in progress, one to come, created out of order.
  const createThree = async () => {
    await createMeeting({ title: "Upcoming", start: hoursFromNow(48) });
    await createMeeting({ title: "Past", start: hoursFromNow(-48) });
    await createMeeting({
      title: "In progress",
      start: hoursFromNow(-1),
      end: hoursFromNow(1),
    });
  };

  it("lists every meeting, soonest first", async () => {
    await createThree();
    const res = await list();
    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(["Past", "In progress", "Upcoming"]);
  });

  it("includes each meeting's venue and book", async () => {
    const venue = await createVenue();
    const book = await createBook({ title: "Circe" });
    await createMeeting({ venueId: venue.id, bookId: book.id });
    await createMeeting({
      title: "No details yet",
      start: new Date("2027-01-05T19:00:00Z"),
    });

    const res = await list();
    expect(res.body).toMatchObject([
      {
        venueId: venue.id,
        venue: { id: venue.id, name: "The Wine Bar" },
        bookId: book.id,
        book: { id: book.id, title: "Circe" },
      },
      { title: "No details yet", venue: null, book: null },
    ]);
  });

  it("?when=upcoming includes meetings in progress, soonest first", async () => {
    await createThree();
    expect(titles(await list("?when=upcoming"))).toEqual([
      "In progress",
      "Upcoming",
    ]);
  });

  it("?when=past lists finished meetings, most recent first", async () => {
    await createThree();
    await createMeeting({ title: "Long ago", start: hoursFromNow(-480) });
    expect(titles(await list("?when=past"))).toEqual(["Past", "Long ago"]);
  });

  it("rejects an unknown ?when with 400", async () => {
    const res = await list("?when=soon");
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("BAD_REQUEST");
  });

  it("returns 401 when signed out", async () => {
    expect((await api.request("GET", "/meetings")).status).toBe(401);
  });
});

describe("GET /meetings/:id", () => {
  it("returns the meeting with its venue and book", async () => {
    const venue = await createVenue();
    const book = await createBook({ title: "Circe" });
    const meeting = await createMeeting({ venueId: venue.id, bookId: book.id });

    const res = await api.request("GET", `/meetings/${meeting.id}`, { as: ada });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: meeting.id,
      title: "Book club",
      start: "2026-12-01T19:00:00.000Z",
      end: "2026-12-01T21:00:00.000Z",
      description: null,
      venue: { name: "The Wine Bar" },
      book: { title: "Circe" },
    });
  });

  it("returns 404 for an unknown meeting", async () => {
    const res = await api.request("GET", `/meetings/${randomUUID()}`, {
      as: ada,
    });
    expect(res.status).toBe(404);
    expect(errorCode(res)).toBe("NOT_FOUND");
  });

  it("returns 401 when signed out", async () => {
    const meeting = await createMeeting();
    expect((await api.request("GET", `/meetings/${meeting.id}`)).status).toBe(
      401,
    );
  });
});

describe("POST /meetings", () => {
  const create = (body: unknown, as: User = admin) =>
    api.request("POST", "/meetings", { as, body });

  it("creates the meeting and returns it with its venue and book", async () => {
    const venue = await createVenue();
    const book = await createBook({ title: "Circe" });
    const res = await create(
      validMeeting({
        title: "  November meeting  ",
        description: "Bring snacks",
        craft: "  Bookmarks: bring old magazines  ",
        venueId: venue.id,
        bookId: book.id,
      }),
    );

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: "November meeting",
      start: "2026-11-20T19:00:00.000Z",
      end: "2026-11-20T21:00:00.000Z",
      description: "Bring snacks",
      craft: "Bookmarks: bring old magazines",
      venue: { id: venue.id },
      book: { id: book.id },
    });
    expect(await prisma.meeting.count()).toBe(1);
  });

  it("leaves the description, venue and book empty when not sent", async () => {
    const res = await create(validMeeting());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      description: null,
      craft: null,
      venueId: null,
      venue: null,
      bookId: null,
      book: null,
    });
  });

  it.each([
    ["no title", { title: undefined }],
    ["a blank title", { title: "   " }],
    ["no start", { start: undefined }],
    ["an end before the start", { end: "2026-11-20T18:00:00.000Z" }],
    ["an end equal to the start", { end: "2026-11-20T19:00:00.000Z" }],
    ["a venue id that isn't a uuid", { venueId: "venue-1" }],
  ])("rejects %s with 400", async (_, overrides) => {
    const res = await create(validMeeting(overrides));
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("BAD_REQUEST");
    expect(await prisma.meeting.count()).toBe(0);
  });

  it("rejects an unknown venue or book with 400", async () => {
    for (const ref of [{ venueId: randomUUID() }, { bookId: randomUUID() }]) {
      const res = await create(validMeeting(ref));
      expect(res.status).toBe(400);
      expect(errorCode(res)).toBe("BAD_REQUEST");
    }
    expect(await prisma.meeting.count()).toBe(0);
  });

  it("returns 409 for a book already on another meeting", async () => {
    const book = await createBook({ title: "Circe" });
    await createMeeting({ bookId: book.id });
    const res = await create(validMeeting({ bookId: book.id }));
    expect(res.status).toBe(409);
    expect(errorCode(res)).toBe("CONFLICT");
    expect(await prisma.meeting.count()).toBe(1);
  });

  it("returns 403 for a member who isn't an admin", async () => {
    const res = await create(validMeeting(), ada);
    expect(res.status).toBe(403);
    expect(errorCode(res)).toBe("FORBIDDEN");
    expect(await prisma.meeting.count()).toBe(0);
  });

  it("returns 401 when signed out", async () => {
    const res = await api.request("POST", "/meetings", { body: validMeeting() });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /meetings/:id", () => {
  const update = (id: string, body: unknown, as: User = admin) =>
    api.request("PATCH", `/meetings/${id}`, { as, body });

  it("changes only the fields sent", async () => {
    const venue = await createVenue();
    const meeting = await createMeeting({ venueId: venue.id });
    const res = await update(meeting.id, { title: "Renamed" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: "Renamed",
      start: "2026-12-01T19:00:00.000Z",
      end: "2026-12-01T21:00:00.000Z",
      venueId: venue.id,
    });
  });

  it("assigns a book", async () => {
    const meeting = await createMeeting();
    const book = await createBook({ title: "Slewfoot" });
    const res = await update(meeting.id, { bookId: book.id });

    expect(res.status).toBe(200);
    expect(res.body.book).toMatchObject({ id: book.id, title: "Slewfoot" });
  });

  it("clears the description, venue and book when sent null", async () => {
    const venue = await createVenue();
    const book = await createBook({ title: "Circe" });
    const meeting = await createMeeting({ venueId: venue.id, bookId: book.id });
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { description: "Bring snacks", craft: "Bookmarks" },
    });

    const res = await update(meeting.id, {
      description: null,
      craft: null,
      venueId: null,
      bookId: null,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      description: null,
      craft: null,
      venue: null,
      book: null,
    });
  });

  it("checks a new end against the saved start", async () => {
    const meeting = await createMeeting();
    const res = await update(meeting.id, { end: "2026-12-01T18:00:00.000Z" });
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("BAD_REQUEST");

    const saved = await prisma.meeting.findUniqueOrThrow({
      where: { id: meeting.id },
    });
    expect(saved.end.toISOString()).toBe("2026-12-01T21:00:00.000Z");
  });

  it("rejects an unknown venue or book with 400", async () => {
    const meeting = await createMeeting();
    for (const ref of [{ venueId: randomUUID() }, { bookId: randomUUID() }]) {
      const res = await update(meeting.id, ref);
      expect(res.status).toBe(400);
    }
  });

  it("returns 409 for a book on another meeting, but allows resending its own", async () => {
    const book = await createBook({ title: "Circe" });
    const october = await createMeeting({ bookId: book.id });
    const november = await createMeeting();

    const taken = await update(november.id, { bookId: book.id });
    expect(taken.status).toBe(409);
    expect(errorCode(taken)).toBe("CONFLICT");

    const own = await update(october.id, { bookId: book.id, title: "October" });
    expect(own.status).toBe(200);
  });

  it("returns 404 for an unknown meeting", async () => {
    const res = await update(randomUUID(), { title: "Renamed" });
    expect(res.status).toBe(404);
    expect(errorCode(res)).toBe("NOT_FOUND");
  });

  it("returns 403 for a member who isn't an admin, and changes nothing", async () => {
    const meeting = await createMeeting();
    const res = await update(meeting.id, { title: "Renamed" }, ada);
    expect(res.status).toBe(403);
    const saved = await prisma.meeting.findUniqueOrThrow({
      where: { id: meeting.id },
    });
    expect(saved.title).toBe("Book club");
  });

  it("returns 401 when signed out", async () => {
    const meeting = await createMeeting();
    const res = await api.request("PATCH", `/meetings/${meeting.id}`, {
      body: { title: "Renamed" },
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /meetings/:id/rsvps", () => {
  const getRsvps = (id: string, as: User = ada) =>
    api.request("GET", `/meetings/${id}/rsvps`, { as });

  it("lists every answer, earliest first, with this member's own", async () => {
    const meeting = await createMeeting({ start: hoursFromNow(48) });
    await prisma.rsvp.create({
      data: {
        userId: admin.id,
        meetingId: meeting.id,
        status: "MAYBE",
        createdAt: hoursFromNow(-2),
      },
    });
    await prisma.rsvp.create({
      data: {
        userId: ada.id,
        meetingId: meeting.id,
        status: "YES",
        dish: "Lemon bars",
        guestCount: 1,
      },
    });

    const res = await getRsvps(meeting.id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      myStatus: "YES",
      rsvps: [
        {
          member: { id: admin.id, firstName: "Admin", lastName: "Reader", image: null },
          status: "MAYBE",
          dish: null,
          guestCount: 0,
        },
        {
          member: { id: ada.id, firstName: "Ada", lastName: "Reader", image: null },
          status: "YES",
          dish: "Lemon bars",
          guestCount: 1,
        },
      ],
    });
  });

  it("returns a null myStatus before this member answers", async () => {
    const meeting = await createMeeting();
    const res = await getRsvps(meeting.id);
    expect(res.body).toEqual({ myStatus: null, rsvps: [] });
  });

  it("returns 404 for an unknown meeting", async () => {
    const res = await getRsvps(randomUUID());
    expect(res.status).toBe(404);
    expect(errorCode(res)).toBe("NOT_FOUND");
  });

  it("returns 401 when signed out", async () => {
    const meeting = await createMeeting();
    const res = await api.request("GET", `/meetings/${meeting.id}/rsvps`);
    expect(res.status).toBe(401);
  });
});

describe("PUT /meetings/:id/rsvp", () => {
  const rsvp = (id: string, body: unknown, as: User = ada) =>
    api.request("PUT", `/meetings/${id}/rsvp`, { as, body });

  it("saves the answer and returns everyone's", async () => {
    const meeting = await createMeeting({ start: hoursFromNow(48) });
    const res = await rsvp(meeting.id, { status: "YES" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      myStatus: "YES",
      rsvps: [{ member: { id: ada.id }, status: "YES" }],
    });
  });

  it("replaces an earlier answer", async () => {
    const meeting = await createMeeting({ start: hoursFromNow(48) });
    await rsvp(meeting.id, { status: "YES" });
    const res = await rsvp(meeting.id, { status: "NO" });

    expect(res.body.myStatus).toBe("NO");
    expect(await prisma.rsvp.count()).toBe(1);
  });

  it("saves what they're bringing and how many guests", async () => {
    const meeting = await createMeeting({ start: hoursFromNow(48) });
    const res = await rsvp(meeting.id, {
      status: "YES",
      dish: "  Lemon bars  ",
      guestCount: 2,
    });
    expect(res.status).toBe(200);
    expect(res.body.rsvps[0]).toMatchObject({ dish: "Lemon bars", guestCount: 2 });
  });

  it("keeps the dish and guests when only the status changes", async () => {
    const meeting = await createMeeting({ start: hoursFromNow(48) });
    await rsvp(meeting.id, { status: "YES", dish: "Lemon bars", guestCount: 2 });
    const res = await rsvp(meeting.id, { status: "MAYBE" });
    expect(res.body.rsvps[0]).toMatchObject({
      status: "MAYBE",
      dish: "Lemon bars",
      guestCount: 2,
    });
  });

  it("clears the dish when sent empty", async () => {
    const meeting = await createMeeting({ start: hoursFromNow(48) });
    await rsvp(meeting.id, { status: "YES", dish: "Lemon bars" });
    const res = await rsvp(meeting.id, { status: "YES", dish: "  " });
    expect(res.body.rsvps[0].dish).toBeNull();
  });

  it("clears the dish and guests for someone who can't come", async () => {
    const meeting = await createMeeting({ start: hoursFromNow(48) });
    await rsvp(meeting.id, { status: "YES", dish: "Lemon bars", guestCount: 2 });
    const res = await rsvp(meeting.id, { status: "NO" });
    expect(res.body.rsvps[0]).toMatchObject({ dish: null, guestCount: 0 });
  });

  it.each([
    ["negative guests", { guestCount: -1 }],
    ["too many guests", { guestCount: 11 }],
    ["a fractional guest", { guestCount: 1.5 }],
    ["a very long dish", { dish: "x".repeat(101) }],
  ])("rejects %s with 400", async (_label, details) => {
    const meeting = await createMeeting({ start: hoursFromNow(48) });
    const res = await rsvp(meeting.id, { status: "YES", ...details });
    expect(res.status).toBe(400);
    expect(await prisma.rsvp.count()).toBe(0);
  });

  it("still takes answers while the meeting is in progress", async () => {
    const meeting = await createMeeting({
      start: hoursFromNow(-1),
      end: hoursFromNow(1),
    });
    expect((await rsvp(meeting.id, { status: "YES" })).status).toBe(200);
  });

  it("rejects an answer once the meeting is over", async () => {
    const meeting = await createMeeting({ start: hoursFromNow(-48) });
    const res = await rsvp(meeting.id, { status: "YES" });
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("BAD_REQUEST");
    expect(await prisma.rsvp.count()).toBe(0);
  });

  it("rejects an unknown status with 400", async () => {
    const meeting = await createMeeting({ start: hoursFromNow(48) });
    const res = await rsvp(meeting.id, { status: "PROBABLY" });
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("BAD_REQUEST");
  });

  it("returns 404 for an unknown meeting", async () => {
    const res = await rsvp(randomUUID(), { status: "YES" });
    expect(res.status).toBe(404);
    expect(errorCode(res)).toBe("NOT_FOUND");
  });

  it("returns 401 when signed out", async () => {
    const meeting = await createMeeting({ start: hoursFromNow(48) });
    const res = await api.request("PUT", `/meetings/${meeting.id}/rsvp`, {
      body: { status: "YES" },
    });
    expect(res.status).toBe(401);
  });
});
