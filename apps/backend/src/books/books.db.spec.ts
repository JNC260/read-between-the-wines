// Book API tests, run against a real test database with
//   npx nx test-db backend
// Open Library is faked by stubbing fetch; everything else is real. The
// Open Library mapping details (query building, authors, covers) stay in
// books.service.spec.ts, which needs no database.
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import {
  addSuggestion,
  createBook,
  createMeeting,
  createRating,
  createUser,
  resetDb,
} from "../test/db";
import { type ApiResponse, startApi } from "../test/http";
import {
  circeSearch,
  circeTitleSearch,
  noResults,
  workWithObjectDescription,
  workWithoutDescription,
  workWithStringDescription,
} from "./open-library.fixtures";

vi.mock("../middleware/auth", () => import("../test/mock-auth"));

// Only the app's calls to Open Library go through this; the test client
// keeps the real fetch (see test/http.ts).
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// Queue the next Open Library response, in call order.
const respond = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status }),
  );

let api: Awaited<ReturnType<typeof startApi>>;

beforeAll(async () => {
  api = await startApi();
});

afterAll(async () => {
  await api.close();
  await prisma.$disconnect();
});

type User = Awaited<ReturnType<typeof createUser>>;

let ada: User;
let ben: User;

beforeEach(async () => {
  fetchMock.mockReset();
  await resetDb();
  ada = await createUser({ firstName: "Ada" });
  ben = await createUser({ firstName: "Ben" });
});

const CIRCE_WORK_ID = "OL18012166W";
const CIRCE_LINK = "https://www.goodreads.com/book/show/35959740-circe";

const errorCode = (res: ApiResponse) => res.body?.error?.code;
const titles = (res: ApiResponse) =>
  res.body.map((b: { title: string }) => b.title);

describe("GET /books/search", () => {
  const search = (q: string, as: User = ada) =>
    api.request("GET", `/books/search?q=${encodeURIComponent(q)}`, { as });

  it("flags works already suggested, and the ones this member suggested", async () => {
    await createBook({
      title: "Circe",
      openLibraryWorkId: CIRCE_WORK_ID,
      suggestedBy: ada.id,
    });
    respond(circeTitleSearch);
    respond(circeTitleSearch);

    const asAda = await search("circe");
    expect(asAda.status).toBe(200);
    expect(asAda.body).toMatchObject([
      { openLibraryWorkId: CIRCE_WORK_ID, alreadySuggested: true, suggestedByMe: true },
      { openLibraryWorkId: "OL21869269W", alreadySuggested: false, suggestedByMe: false },
    ]);

    const asBen = await search("circe", ben);
    expect(asBen.body[0]).toMatchObject({
      alreadySuggested: true,
      suggestedByMe: false,
    });
  });

  it("rejects a blank or missing query with 400 without calling Open Library", async () => {
    expect((await search("   ")).status).toBe(400);
    const missing = await api.request("GET", "/books/search", { as: ada });
    expect(missing.status).toBe(400);
    expect(errorCode(missing)).toBe("BAD_REQUEST");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 502 when Open Library is down", async () => {
    respond({}, 503);
    const res = await search("circe");
    expect(res.status).toBe(502);
    expect(errorCode(res)).toBe("BAD_GATEWAY");
  });

  it("returns 401 when signed out", async () => {
    const res = await api.request("GET", "/books/search?q=circe");
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /books/suggestions", () => {
  const suggest = (body: unknown, as: User = ada) =>
    api.request("POST", "/books/suggestions", { as, body });

  // createSuggestion looks the work up, then fetches its description.
  const respondWithCirce = (work: unknown = workWithStringDescription) => {
    respond(circeSearch);
    respond(work);
  };

  it("saves the book from Open Library and this member's suggestion", async () => {
    respondWithCirce();
    const res = await suggest({ openLibraryWorkId: CIRCE_WORK_ID });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: "Circe",
      author: "Madeline Miller",
      yearPublished: 2018,
      pageCount: 404,
      coverUrl: "https://covers.openlibrary.org/b/id/8739376-L.jpg",
      synopsis: workWithStringDescription.description,
      openLibraryWorkId: CIRCE_WORK_ID,
      goodreadsUrl: null,
    });
    const saved = await prisma.book.findUniqueOrThrow({
      where: { id: res.body.id },
      include: { suggestions: true },
    });
    expect(saved.normalizedTitle).toBe("circe");
    expect(saved.suggestions.map((s) => s.userId)).toEqual([ada.id]);
  });

  it.each([
    ["a string", workWithStringDescription, workWithStringDescription.description],
    ["an object", workWithObjectDescription, workWithObjectDescription.description.value],
    ["missing", workWithoutDescription, null],
  ])("saves the synopsis when the description is %s", async (_, work, synopsis) => {
    respondWithCirce(work);
    const res = await suggest({ openLibraryWorkId: CIRCE_WORK_ID });
    expect(res.status).toBe(201);
    const saved = await prisma.book.findUniqueOrThrow({
      where: { id: res.body.id },
    });
    expect(saved.synopsis).toBe(synopsis);
  });

  it("saves a pasted Goodreads link", async () => {
    respondWithCirce();
    const res = await suggest({
      openLibraryWorkId: CIRCE_WORK_ID,
      goodreadsUrl: CIRCE_LINK,
    });
    expect(res.status).toBe(201);
    expect(res.body.goodreadsUrl).toBe(CIRCE_LINK);
  });

  it("adds a second member's suggestion to the same book", async () => {
    respondWithCirce();
    const first = await suggest({ openLibraryWorkId: CIRCE_WORK_ID });
    respondWithCirce();
    const second = await suggest({ openLibraryWorkId: CIRCE_WORK_ID }, ben);

    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(await prisma.book.count()).toBe(1);
    expect(await prisma.suggestion.count()).toBe(2);
  });

  it("returns 409 when this member already suggested the book", async () => {
    respondWithCirce();
    await suggest({ openLibraryWorkId: CIRCE_WORK_ID });
    respondWithCirce();
    const res = await suggest({ openLibraryWorkId: CIRCE_WORK_ID });

    expect(res.status).toBe(409);
    expect(errorCode(res)).toBe("CONFLICT");
    expect(await prisma.suggestion.count()).toBe(1);
  });

  it("returns 404 for a work Open Library doesn't know, and saves nothing", async () => {
    respond(noResults);
    const res = await suggest({ openLibraryWorkId: "OL999W" });
    expect(res.status).toBe(404);
    expect(errorCode(res)).toBe("NOT_FOUND");
    expect(await prisma.book.count()).toBe(0);
  });

  it.each([
    ["no work id", {}],
    ["a link that isn't Goodreads", { openLibraryWorkId: CIRCE_WORK_ID, goodreadsUrl: "https://example.com/circe" }],
  ])("rejects a body with %s with 400", async (_, body) => {
    const res = await suggest(body);
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("BAD_REQUEST");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 401 when signed out", async () => {
    const res = await api.request("POST", "/books/suggestions", {
      body: { openLibraryWorkId: CIRCE_WORK_ID },
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /books/suggestions", () => {
  const list = (as: User = ada) =>
    api.request("GET", "/books/suggestions", { as });

  it("returns [] when nothing has been suggested", async () => {
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("leaves out books nobody suggested and books on a meeting", async () => {
    await createBook({ title: "Circe", suggestedBy: ada.id });
    await createBook({ title: "Unsuggested" });
    const read = await createBook({ title: "Read", suggestedBy: ada.id });
    await createMeeting({ bookId: read.id });

    expect(titles(await list())).toEqual(["Circe"]);
  });

  it("names every suggester, first suggester first, and dates the book by them", async () => {
    const circe = await createBook({ title: "Circe" });
    await addSuggestion(ada.id, circe.id, new Date("2026-10-05T00:00:00Z"));
    await addSuggestion(ben.id, circe.id, new Date("2026-10-02T00:00:00Z"));
    const photo = "/api/uploads/00000000-0000-4000-8000-000000000001.webp";
    await prisma.user.update({ where: { id: ben.id }, data: { image: photo } });

    const [book] = (await list()).body;
    // Names and photos only: no emails go to other members.
    expect(book.suggestedBy).toEqual([
      { id: ben.id, firstName: "Ben", lastName: "Reader", image: photo },
      { id: ada.id, firstName: "Ada", lastName: "Reader", image: null },
    ]);
    expect(book.suggestedAt).toBe("2026-10-02T00:00:00.000Z");
  });

  it("flags the books this member suggested", async () => {
    await createBook({ title: "Mine", suggestedBy: ada.id });
    await createBook({ title: "Ben's", suggestedBy: ben.id });

    const mine = Object.fromEntries(
      (await list()).body.map((b: { title: string; suggestedByMe: boolean }) => [
        b.title,
        b.suggestedByMe,
      ]),
    );
    expect(mine).toEqual({ Mine: true, "Ben's": false });
  });

  it("lists the newest suggestion first, without synopses", async () => {
    const older = await createBook({ title: "Older" });
    const newer = await createBook({ title: "Newer" });
    await addSuggestion(ada.id, older.id, new Date("2026-10-01T00:00:00Z"));
    await addSuggestion(ada.id, newer.id, new Date("2026-10-09T00:00:00Z"));

    const res = await list();
    expect(titles(res)).toEqual(["Newer", "Older"]);
    expect(res.body[0]).not.toHaveProperty("synopsis");
  });

  it("returns 401 when signed out", async () => {
    expect((await api.request("GET", "/books/suggestions")).status).toBe(401);
  });
});

describe("GET /books/read", () => {
  const list = (as: User = ada) => api.request("GET", "/books/read", { as });

  it("lists books on a meeting, latest meeting first, with the meeting", async () => {
    const circe = await createBook({ title: "Circe" });
    const piranesi = await createBook({ title: "Piranesi" });
    await createBook({ title: "Not read", suggestedBy: ada.id });
    const september = await createMeeting({
      bookId: circe.id,
      start: new Date("2026-09-10T19:00:00Z"),
    });
    await createMeeting({ start: new Date("2026-10-10T19:00:00Z") });
    await createMeeting({
      bookId: piranesi.id,
      start: new Date("2026-08-10T19:00:00Z"),
    });

    const res = await list();
    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(["Circe", "Piranesi"]);
    expect(res.body[0]).toMatchObject({
      id: circe.id,
      meetingId: september.id,
      meetingStart: "2026-09-10T19:00:00.000Z",
    });
  });

  it("averages the ratings and picks out this member's", async () => {
    const circe = await createBook({ title: "Circe" });
    await createMeeting({ bookId: circe.id });
    const cy = await createUser({ firstName: "Cy" });
    await createRating(ada.id, circe.id, 4);
    await createRating(ben.id, circe.id, 5);
    await createRating(cy.id, circe.id, 2);

    const [book] = (await list()).body;
    expect(book).toMatchObject({
      averageRating: 11 / 3,
      ratingCount: 3,
      myRating: 4,
    });
  });

  it("has no average or rating of mine until rated", async () => {
    const circe = await createBook({ title: "Circe" });
    const piranesi = await createBook({ title: "Piranesi" });
    await createMeeting({ bookId: circe.id, start: new Date("2026-09-10T19:00:00Z") });
    await createMeeting({ bookId: piranesi.id, start: new Date("2026-08-10T19:00:00Z") });
    await createRating(ben.id, circe.id, 3);

    const [ratedByBen, unrated] = (await list()).body;
    expect(ratedByBen).toMatchObject({ averageRating: 3, myRating: null });
    expect(unrated).toMatchObject({
      averageRating: null,
      ratingCount: 0,
      myRating: null,
    });
  });

  it("flags the books this member suggested", async () => {
    const circe = await createBook({ title: "Circe", suggestedBy: ben.id });
    const piranesi = await createBook({ title: "Piranesi", suggestedBy: ada.id });
    await createMeeting({ bookId: circe.id, start: new Date("2026-09-10T19:00:00Z") });
    await createMeeting({ bookId: piranesi.id, start: new Date("2026-08-10T19:00:00Z") });

    const [byBen, byMe] = (await list()).body;
    expect(byBen).toMatchObject({ title: "Circe", suggestedByMe: false });
    expect(byMe).toMatchObject({ title: "Piranesi", suggestedByMe: true });
  });

  it("returns 401 when signed out", async () => {
    expect((await api.request("GET", "/books/read")).status).toBe(401);
  });
});

describe("PUT /books/:id/rating", () => {
  const rate = (bookId: string, score: unknown, as: User = ada) =>
    api.request("PUT", `/books/${bookId}/rating`, { as, body: { score } });

  const readBook = async () => {
    const book = await createBook({ title: "Circe" });
    await createMeeting({ bookId: book.id });
    return book;
  };

  it("saves this member's rating and returns it", async () => {
    const book = await readBook();
    const res = await rate(book.id, 4);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ bookId: book.id, score: 4 });
    expect(await prisma.rating.findMany()).toMatchObject([
      { userId: ada.id, bookId: book.id, score: 4 },
    ]);
  });

  it("replaces this member's earlier rating and leaves others alone", async () => {
    const book = await readBook();
    await createRating(ben.id, book.id, 2);
    await rate(book.id, 4);
    await rate(book.id, 5);

    const ratings = await prisma.rating.findMany({ orderBy: { score: "asc" } });
    expect(ratings.map((r) => [r.userId, r.score])).toEqual([
      [ben.id, 2],
      [ada.id, 5],
    ]);
  });

  it("shows up in the read books list", async () => {
    const book = await readBook();
    await rate(book.id, 4);
    await rate(book.id, 2, ben);

    const [listed] = (await api.request("GET", "/books/read", { as: ada })).body;
    expect(listed).toMatchObject({ averageRating: 3, ratingCount: 2, myRating: 4 });
  });

  it.each([
    ["0", 0],
    ["6", 6],
    ["a fraction", 3.5],
    ["a string", "4"],
    ["nothing", undefined],
  ])("rejects a score of %s with 400", async (_, score) => {
    const book = await readBook();
    const res = await rate(book.id, score);
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("BAD_REQUEST");
  });

  it("returns 403 for a book the club hasn't read, and saves nothing", async () => {
    const book = await createBook({ title: "Circe", suggestedBy: ada.id });
    const res = await rate(book.id, 4);
    expect(res.status).toBe(403);
    expect(errorCode(res)).toBe("FORBIDDEN");
    expect(await prisma.rating.count()).toBe(0);
  });

  it("returns 404 for an unknown book", async () => {
    const res = await rate(randomUUID(), 4);
    expect(res.status).toBe(404);
    expect(errorCode(res)).toBe("NOT_FOUND");
  });

  it("returns 401 when signed out", async () => {
    const book = await readBook();
    const res = await api.request("PUT", `/books/${book.id}/rating`, {
      body: { score: 4 },
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /books/:id", () => {
  const get = (id: string, as: User = ada) =>
    api.request("GET", `/books/${id}`, { as });

  it("returns the whole book, synopsis included", async () => {
    const book = await createBook({ title: "Circe", suggestedBy: ada.id });
    const res = await get(book.id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: book.id,
      title: "Circe",
      synopsis: "What Circe is about.",
    });
  });

  it("lets every suggester and admins edit, and nobody else", async () => {
    const book = await createBook({ title: "Circe", suggestedBy: ada.id });
    await addSuggestion(ben.id, book.id);
    const cy = await createUser({ firstName: "Cy" });
    const admin = await createUser({ firstName: "Dee", isAdmin: true });

    expect((await get(book.id, ada)).body.canEdit).toBe(true);
    expect((await get(book.id, ben)).body.canEdit).toBe(true);
    expect((await get(book.id, cy)).body.canEdit).toBe(false);
    expect((await get(book.id, admin)).body.canEdit).toBe(true);
  });

  it("returns 404 for an unknown book", async () => {
    const res = await get(randomUUID());
    expect(res.status).toBe(404);
    expect(errorCode(res)).toBe("NOT_FOUND");
  });

  it("returns 401 when signed out", async () => {
    const book = await createBook();
    expect((await api.request("GET", `/books/${book.id}`)).status).toBe(401);
  });
});

describe("PATCH /books/:id", () => {
  const edit = (id: string, body: unknown, as: User = ada) =>
    api.request("PATCH", `/books/${id}`, { as, body });

  const everyField = {
    title: "The Song of Achilles",
    author: "Madeline Miller",
    yearPublished: 2011,
    genres: ["Fantasy", "Historical fiction"],
    coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg",
    synopsis: "Patroclus and Achilles.",
    pageCount: 378,
    goodreadsUrl: "https://www.goodreads.com/book/show/11250317",
  };

  it("saves every field for the member who suggested it", async () => {
    const book = await createBook({ title: "Circe", suggestedBy: ada.id });
    const res = await edit(book.id, everyField);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: book.id, ...everyField });
    expect(await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).toMatchObject({
      ...everyField,
      normalizedTitle: "song of achilles",
    });
  });

  it("keeps fields left out and clears fields sent as null", async () => {
    const book = await createBook({ title: "Circe", suggestedBy: ada.id });
    await edit(book.id, { synopsis: null, yearPublished: 2018 });

    expect(await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).toMatchObject({
      title: "Circe",
      normalizedTitle: "circe",
      synopsis: null,
      yearPublished: 2018,
    });
  });

  it("lets a second suggester edit too", async () => {
    const book = await createBook({ title: "Circe", suggestedBy: ada.id });
    await addSuggestion(ben.id, book.id);
    const res = await edit(book.id, { pageCount: 393 }, ben);
    expect(res.status).toBe(200);
    expect(res.body.pageCount).toBe(393);
  });

  it("lets an admin edit a book they didn't suggest", async () => {
    const book = await createBook({ title: "Circe", suggestedBy: ben.id });
    const admin = await createUser({ firstName: "Dee", isAdmin: true });
    const res = await edit(book.id, { title: "Circe: A Novel" }, admin);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Circe: A Novel");
  });

  it("returns 403 for a member who didn't suggest it, and changes nothing", async () => {
    const book = await createBook({ title: "Circe", suggestedBy: ben.id });
    const res = await edit(book.id, { title: "Hacked" });
    expect(res.status).toBe(403);
    expect(errorCode(res)).toBe("FORBIDDEN");
    expect((await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).title).toBe(
      "Circe",
    );
  });

  it("ignores a work id, which isn't editable", async () => {
    const book = await createBook({
      title: "Circe",
      openLibraryWorkId: CIRCE_WORK_ID,
      suggestedBy: ada.id,
    });
    const res = await edit(book.id, { openLibraryWorkId: "OL16295851W", pageCount: 393 });
    expect(res.status).toBe(200);
    expect(await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).toMatchObject({
      openLibraryWorkId: CIRCE_WORK_ID,
      pageCount: 393,
    });
  });

  it.each([
    ["a blank title", { title: "  " }],
    ["a null author", { author: null }],
    ["a fractional year", { yearPublished: 2011.5 }],
    ["zero pages", { pageCount: 0 }],
    ["a cover that isn't a web link", { coverUrl: "javascript:alert(1)" }],
    ["a link that isn't Goodreads", { goodreadsUrl: "https://example.com/book" }],
    ["a blank genre", { genres: ["Fantasy", " "] }],
  ])("rejects %s with 400", async (_, body) => {
    const book = await createBook({ title: "Circe", suggestedBy: ada.id });
    const res = await edit(book.id, body);
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("BAD_REQUEST");
  });

  it("returns 404 for an unknown book", async () => {
    const res = await edit(randomUUID(), { title: "Circe" });
    expect(res.status).toBe(404);
    expect(errorCode(res)).toBe("NOT_FOUND");
  });

  it("returns 401 when signed out", async () => {
    const book = await createBook({ suggestedBy: ada.id });
    const res = await api.request("PATCH", `/books/${book.id}`, {
      body: { title: "Circe" },
    });
    expect(res.status).toBe(401);
  });
});
