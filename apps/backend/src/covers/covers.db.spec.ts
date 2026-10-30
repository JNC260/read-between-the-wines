// The cover cache, against a real test database and the test upload folder:
//   npx nx test-db backend
// Open Library is faked by stubbing fetch.
import { rm } from "node:fs/promises";
import { config } from "../lib/config";
import { prisma } from "../lib/prisma";
import { createBook, resetDb } from "../test/db";
import { startApi } from "../test/http";

vi.mock("../middleware/auth", () => import("../test/mock-auth"));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

let api: Awaited<ReturnType<typeof startApi>>;

beforeAll(async () => {
  api = await startApi();
});

afterAll(async () => {
  await api.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  fetchMock.mockReset();
  await resetDb();
  await rm(config.UPLOAD_DIR, { recursive: true, force: true });
});

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const openLibraryHas = () =>
  fetchMock.mockResolvedValue(
    new Response(JPEG, { status: 200, headers: { "content-type": "image/jpeg" } }),
  );

const ourBookWithCover = async (file = "8739376-L.jpg") => {
  const book = await createBook({ title: "Circe" });
  await prisma.book.update({
    where: { id: book.id },
    data: { coverUrl: `https://covers.openlibrary.org/b/id/${file}` },
  });
};

// Images aren't JSON, so these use the raw fetch.
const get = (file: string) => api.fetchRaw(`/api/covers/${file}`);

describe("GET /covers/:file", () => {
  it("fetches a book's cover once, then serves its own copy for good", async () => {
    await ourBookWithCover();
    openLibraryHas();

    const first = await get("8739376-L.jpg");
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(first.headers.get("content-type")).toMatch(/^image\/jpeg/);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://covers.openlibrary.org/b/id/8739376-L.jpg?default=false",
    );

    const second = await get("8739376-L.jpg");
    expect(second.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("shares one download between requests at the same moment", async () => {
    await ourBookWithCover();
    openLibraryHas();
    const results = await Promise.all([1, 2, 3].map(() => get("8739376-L.jpg")));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("won't fetch covers no book of ours uses", async () => {
    openLibraryHas();
    expect((await get("12345-L.jpg")).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects names that aren't a cover id and size", async () => {
    expect((await get("..%2F..%2F.env")).status).toBe(404);
    expect((await get("8739376-L.png")).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes on a 404 for a cover Open Library doesn't have", async () => {
    await ourBookWithCover();
    fetchMock.mockResolvedValue(new Response("not found", { status: 404 }));
    expect((await get("8739376-L.jpg")).status).toBe(404);
  });

  it("returns 502 when Open Library fails, and tries again next time", async () => {
    await ourBookWithCover();
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect((await get("8739376-L.jpg")).status).toBe(502);
    openLibraryHas();
    expect((await get("8739376-L.jpg")).status).toBe(200);
  });
});
