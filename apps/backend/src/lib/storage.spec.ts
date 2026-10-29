import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { deleteImage, saveImage, UPLOADS_URL_PATH } from "./storage";

// A fresh folder per run, so tests never touch the real uploads/. Hoisted
// because vi.mock runs before the imports above, so it imports for itself.
const { UPLOAD_DIR } = await vi.hoisted(async () => {
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  return { UPLOAD_DIR: join(tmpdir(), `rbtw-storage-${process.pid}`, "uploads") };
});
vi.mock("./config", () => ({ config: { UPLOAD_DIR } }));

const image = (bytes = "fake webp bytes") => ({
  buffer: Buffer.from(bytes),
  contentType: "image/webp" as const,
});

const fileFor = (url: string) =>
  path.join(UPLOAD_DIR, url.slice(`${UPLOADS_URL_PATH}/`.length));

afterAll(async () => {
  await rm(path.dirname(UPLOAD_DIR), { recursive: true, force: true });
});

describe("saveImage", () => {
  it("writes the file under a random name and returns its URL", async () => {
    const url = await saveImage(image("hello"));
    expect(url).toMatch(/^\/api\/uploads\/[0-9a-f-]{36}\.webp$/);
    expect(await readFile(fileFor(url), "utf8")).toBe("hello");
  });

  it("names each upload differently", async () => {
    const [a, b] = await Promise.all([saveImage(image()), saveImage(image())]);
    expect(a).not.toBe(b);
  });

  it("picks the extension from the type", async () => {
    const url = await saveImage({ ...image(), contentType: "image/jpeg" });
    expect(url).toMatch(/\.jpg$/);
  });

  it("creates the folder if it's missing", async () => {
    await rm(UPLOAD_DIR, { recursive: true, force: true });
    const url = await saveImage(image());
    expect(existsSync(fileFor(url))).toBe(true);
  });
});

describe("deleteImage", () => {
  it("deletes a file saveImage made", async () => {
    const url = await saveImage(image());
    await deleteImage(url);
    expect(existsSync(fileFor(url))).toBe(false);
  });

  it("doesn't mind a file that's already gone", async () => {
    const url = await saveImage(image());
    await deleteImage(url);
    await expect(deleteImage(url)).resolves.toBeUndefined();
  });

  // Decoys inside the folder and next to it, standing in for files like
  // .env that a crafted URL might reach for.
  it.each([
    ["a URL from elsewhere", "https://example.com/secret.txt"],
    ["a path out of the folder", `${UPLOADS_URL_PATH}/../secret.txt`],
    ["a name saveImage wouldn't make", `${UPLOADS_URL_PATH}/secret.txt`],
  ])("ignores %s", async (_label, url) => {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const decoys = [
      path.join(UPLOAD_DIR, "secret.txt"),
      path.join(UPLOAD_DIR, "..", "secret.txt"),
    ];
    for (const decoy of decoys) {
      await writeFile(decoy, "keep");
    }
    await deleteImage(url);
    for (const decoy of decoys) {
      expect(existsSync(decoy)).toBe(true);
      await rm(decoy);
    }
  });

  it("only removes the one file", async () => {
    const keep = await saveImage(image());
    const remove = await saveImage(image());
    await deleteImage(remove);
    const left = await readdir(UPLOAD_DIR);
    expect(left).toContain(path.basename(keep));
    expect(left).not.toContain(path.basename(remove));
  });
});
