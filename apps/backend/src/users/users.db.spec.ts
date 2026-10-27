// User API tests, run against a real test database with
//   npx nx test-db backend
import { prisma } from "../lib/prisma";
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
    });
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("BAD_REQUEST");
    expect(Object.keys(fieldErrors(res)).sort()).toEqual([
      "firstName",
      "instagram",
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
