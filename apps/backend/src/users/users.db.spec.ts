// User API tests, run against a real test database with
//   npx nx test-db backend
import { existsSync } from "node:fs";
import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { MAX_PROFILE_IMAGE_BYTES } from "shared";
import { config } from "../lib/config";
import { prisma } from "../lib/prisma";
import { UPLOADS_URL_PATH } from "../lib/storage";
import { createUser, resetDb } from "../test/db";
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

let ada: User;
let grace: User;

beforeEach(async () => {
  await resetDb();
  await rm(config.UPLOAD_DIR, { recursive: true, force: true });
  ada = await createUser({ firstName: "Ada" });
  grace = await createUser({ firstName: "Grace" });
});

const errorCode = (res: ApiResponse) => res.body?.error?.code;
const fieldErrors = (res: ApiResponse) => res.body?.error?.details?.fieldErrors;

describe("GET /users", () => {
  const names = (res: ApiResponse) =>
    res.body.map(
      (u: { firstName: string; lastName: string }) =>
        `${u.firstName} ${u.lastName}`,
    );

  it("lists active members by first name, then last name", async () => {
    await prisma.user.update({
      where: { id: grace.id },
      data: { lastName: "Hopper" },
    });
    await createUser({ firstName: "Grace" }); // Grace Reader
    await createUser({ firstName: "Barbara" });
    const res = await api.request("GET", "/users", { as: ada });
    expect(res.status).toBe(200);
    expect(names(res)).toEqual([
      "Ada Reader",
      "Barbara Reader",
      "Grace Hopper",
      "Grace Reader",
    ]);
  });

  it("leaves out inactive and banned members", async () => {
    const left = await createUser({ firstName: "Leftie" });
    const banned = await createUser({ firstName: "Banned" });
    await prisma.user.update({
      where: { id: left.id },
      data: { status: "INACTIVE" },
    });
    await prisma.user.update({
      where: { id: banned.id },
      data: { status: "BANNED" },
    });
    const res = await api.request("GET", "/users", { as: ada });
    expect(names(res)).toEqual(["Ada Reader", "Grace Reader"]);
  });

  it("returns 401 when signed out", async () => {
    expect((await api.request("GET", "/users")).status).toBe(401);
  });
});

describe("PATCH /users/me", () => {
  const update = (body: unknown, as: User = ada) =>
    api.request("PATCH", "/users/me", { as, body });

  it("saves every profile field, normalized", async () => {
    const res = await update({
      phone: "(555) 123-4567",
      facebookUrl: "facebook.com/ada",
      goodreadsUrl: "https://www.goodreads.com/user/show/1-ada",
      instagram: "@ada",
      tiktok: "https://www.tiktok.com/@ada",
      x: "x.com/ada",
      venmo: "https://venmo.com/u/ada",
      memberSince: 2019,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: ada.id,
      phone: "+15551234567",
      facebookUrl: "https://facebook.com/ada",
      goodreadsUrl: "https://www.goodreads.com/user/show/1-ada",
      instagram: "ada",
      tiktok: "ada",
      x: "ada",
      venmo: "ada",
      memberSince: 2019,
    });
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: ada.id } });
    expect(saved.phone).toBe("+15551234567");
    expect(saved.venmo).toBe("ada");
  });

  it("keeps the display name in step with first and last name", async () => {
    const res = await update({ firstName: "Augusta" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      firstName: "Augusta",
      lastName: "Reader",
      name: "Augusta Reader",
    });

    const again = await update({ lastName: "Lovelace" });
    expect(again.body.name).toBe("Augusta Lovelace");
  });

  it("leaves out fields as they were and clears fields sent as null", async () => {
    await update({ instagram: "ada", venmo: "ada" });
    const res = await update({ venmo: null });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ instagram: "ada", venmo: null });
  });

  it("only changes the signed-in member", async () => {
    await update({ instagram: "ada" });
    const other = await prisma.user.findUniqueOrThrow({ where: { id: grace.id } });
    expect(other.instagram).toBeNull();
  });

  it("ignores fields members can't change here", async () => {
    const res = await update({
      email: "new@example.com",
      isAdmin: true,
      status: "BANNED",
      image: "https://example.com/me.jpg",
    });
    expect(res.status).toBe(200);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: ada.id } });
    expect(saved).toMatchObject({
      email: ada.email,
      isAdmin: false,
      status: "ACTIVE",
      image: null,
    });
  });

  it("returns 400 with a message for each bad field", async () => {
    const res = await update({
      firstName: " ",
      phone: "555-1234",
      instagram: "https://facebook.com/ada",
      memberSince: new Date().getFullYear() + 1,
    });
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("BAD_REQUEST");
    expect(Object.keys(fieldErrors(res)).sort()).toEqual([
      "firstName",
      "instagram",
      "memberSince",
      "phone",
    ]);
  });

  it("shows the new fields in the member list", async () => {
    await update({ venmo: "ada" });
    const res = await api.request("GET", "/users", { as: grace });
    expect(res.status).toBe(200);
    const listed = res.body.find((u: { id: string }) => u.id === ada.id);
    expect(listed).toMatchObject({ venmo: "ada", phone: null });
  });

  it("returns 401 when signed out", async () => {
    const res = await api.request("PATCH", "/users/me", { body: {} });
    expect(res.status).toBe(401);
  });
});

// A tiny real PNG, made fresh so the repo needs no fixture files.
const png = () =>
  sharp({
    create: { width: 40, height: 30, channels: 3, background: "#c81d6b" },
  })
    .png()
    .toBuffer();

const photoForm = (bytes: Buffer, type = "image/png", name = "me.png") => {
  const form = new FormData();
  form.append("image", new File([new Uint8Array(bytes)], name, { type }));
  return form;
};

// The file behind a URL saveImage returned, in the test's UPLOAD_DIR.
const fileFor = (url: string) =>
  path.join(config.UPLOAD_DIR, url.slice(`${UPLOADS_URL_PATH}/`.length));

const uploadedFiles = async () =>
  existsSync(config.UPLOAD_DIR) ? readdir(config.UPLOAD_DIR) : [];

const imageOf = async (user: User) =>
  (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).image;

describe("PUT /users/me/image", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const upload = (form: FormData, as: User = ada) =>
    api.request("PUT", "/users/me/image", { as, form });

  it("saves the image and returns the user with its URL", async () => {
    const res = await upload(photoForm(await png()));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ada.id);
    expect(res.body.image).toMatch(/^\/api\/uploads\/[0-9a-f-]{36}\.webp$/);
    expect(await imageOf(ada)).toBe(res.body.image);

    // Stored resized and re-encoded, and served at the URL.
    const meta = await sharp(await readFile(fileFor(res.body.image))).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 512, height: 512 });
    const served = await api.fetchRaw(res.body.image);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/webp");
  });

  it("replaces an existing image and deletes the old file", async () => {
    const first = (await upload(photoForm(await png()))).body.image;
    const second = (await upload(photoForm(await png()))).body.image;
    expect(second).not.toBe(first);
    expect(await imageOf(ada)).toBe(second);
    expect(existsSync(fileFor(first))).toBe(false);
    expect(existsSync(fileFor(second))).toBe(true);
  });

  it("returns 400 with no file", async () => {
    const res = await upload(new FormData());
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("BAD_REQUEST");
  });

  it("returns 400 for a file that isn't an allowed image type", async () => {
    const res = await upload(photoForm(await png(), "image/gif", "me.gif"));
    expect(res.status).toBe(400);
    expect(await imageOf(ada)).toBeNull();
  });

  it("returns 400 for a file over the size limit", async () => {
    const huge = Buffer.alloc(MAX_PROFILE_IMAGE_BYTES + 1);
    const res = await upload(photoForm(huge));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Photos can be up to 10 MB");
  });

  it("returns 400 for a file that only claims to be an image, saving nothing", async () => {
    const before = await uploadedFiles();
    const res = await upload(photoForm(Buffer.from("%PDF-1.7 not a photo")));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("That file isn't an image we can read");
    expect(await uploadedFiles()).toEqual(before);
    expect(await imageOf(ada)).toBeNull();
  });

  it("keeps the old photo, and saves no file, if the update fails", async () => {
    const old = (await upload(photoForm(await png()))).body.image;
    const before = await uploadedFiles();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(prisma.user, "update").mockRejectedValueOnce(new Error("db down"));

    const res = await upload(photoForm(await png()));
    expect(res.status).toBe(500);
    expect(await uploadedFiles()).toEqual(before);
    expect(await imageOf(ada)).toBe(old);
    expect(existsSync(fileFor(old))).toBe(true);
  });

  it("leaves other members' photos alone", async () => {
    const graces = (await upload(photoForm(await png()), grace)).body.image;
    await upload(photoForm(await png()));
    await upload(photoForm(await png()));
    expect(await imageOf(grace)).toBe(graces);
    expect(existsSync(fileFor(graces))).toBe(true);
  });

  it("shows the photo in the member list", async () => {
    const url = (await upload(photoForm(await png()))).body.image;
    const res = await api.request("GET", "/users", { as: grace });
    const listed = res.body.find((u: { id: string }) => u.id === ada.id);
    expect(listed.image).toBe(url);
  });

  it("returns 401 when signed out", async () => {
    const res = await api.request("PUT", "/users/me/image", {
      form: photoForm(await png()),
    });
    expect(res.status).toBe(401);
    expect(await uploadedFiles()).toEqual([]);
  });
});

describe("DELETE /users/me/image", () => {
  const remove = (as?: User) => api.request("DELETE", "/users/me/image", { as });

  it("clears the image and deletes the file", async () => {
    const form = photoForm(await png());
    const url = (await api.request("PUT", "/users/me/image", { as: ada, form }))
      .body.image;
    const res = await remove(ada);
    expect(res.status).toBe(200);
    expect(res.body.image).toBeNull();
    expect(await imageOf(ada)).toBeNull();
    expect(existsSync(fileFor(url))).toBe(false);
  });

  it("succeeds when there's no image", async () => {
    const res = await remove(ada);
    expect(res.status).toBe(200);
    expect(res.body.image).toBeNull();
  });

  it("leaves an image that isn't one of our uploads in place on disk", async () => {
    // Say an image URL from somewhere else got into the column.
    await prisma.user.update({
      where: { id: ada.id },
      data: { image: "https://example.com/ada.jpg" },
    });
    const res = await remove(ada);
    expect(res.status).toBe(200);
    expect(await imageOf(ada)).toBeNull();
  });

  it("returns 401 when signed out", async () => {
    expect((await remove()).status).toBe(401);
  });
});
