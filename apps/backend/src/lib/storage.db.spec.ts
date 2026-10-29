// Serving uploaded files through the real app, with
//   npx nx test-db backend
// (db-setup points UPLOAD_DIR at a throwaway folder.)
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { startApi } from "../test/http";
import { config } from "./config";
import { saveImage } from "./storage";

let api: Awaited<ReturnType<typeof startApi>>;

beforeAll(async () => {
  api = await startApi();
});

afterAll(async () => {
  await api.close();
});

describe("GET /api/uploads/:file", () => {
  it("serves a saved image with long caching, without signing in", async () => {
    const url = await saveImage({
      buffer: Buffer.from("webp bytes"),
      contentType: "image/webp",
    });
    const res = await api.fetchRaw(url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await res.text()).toBe("webp bytes");
  });

  it("answers a missing file with the usual JSON 404", async () => {
    const res = await api.fetchRaw("/api/uploads/nothing-here.webp");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("answers hidden files with a 404", async () => {
    await saveImage({ buffer: Buffer.from("x"), contentType: "image/webp" });
    await writeFile(path.join(config.UPLOAD_DIR, ".env"), "SECRET=1");
    const res = await api.fetchRaw("/api/uploads/.env");
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("SECRET");
  });

  it("answers paths out of the folder with a 404", async () => {
    await writeFile(path.join(config.UPLOAD_DIR, "..", "outside.txt"), "nope");
    const res = await api.fetchRaw("/api/uploads/..%2Foutside.txt");
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("nope");
  });
});
