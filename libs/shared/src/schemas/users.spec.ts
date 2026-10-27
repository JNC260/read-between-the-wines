import * as z from "zod";
import { UpdateProfileSchema } from "./users";

describe("UpdateProfileSchema", () => {
  it("accepts an empty update", () => {
    expect(UpdateProfileSchema.parse({})).toEqual({});
  });

  it("normalizes each field", () => {
    expect(
      UpdateProfileSchema.parse({
        firstName: " Jen ",
        phone: "(555) 123-4567",
        facebookUrl: "facebook.com/jen",
        goodreadsUrl: "http://www.goodreads.com/user/show/123-jen",
        instagram: "@jen",
        tiktok: "https://www.tiktok.com/@jen",
        x: "https://twitter.com/jen",
        venmo: "venmo.com/u/jen",
      }),
    ).toEqual({
      firstName: "Jen",
      phone: "+15551234567",
      facebookUrl: "https://facebook.com/jen",
      goodreadsUrl: "https://www.goodreads.com/user/show/123-jen",
      instagram: "jen",
      tiktok: "jen",
      x: "jen",
      venmo: "jen",
    });
  });

  it("accepts null to clear a field", () => {
    expect(UpdateProfileSchema.parse({ phone: null, venmo: null })).toEqual({
      phone: null,
      venmo: null,
    });
  });

  // The frontend encodes form values before sending them.
  it("normalizes on encode too", () => {
    expect(
      z.encode(UpdateProfileSchema, { phone: "555.123.4567", instagram: "@jen" }),
    ).toEqual({ phone: "+15551234567", instagram: "jen" });
  });

  it.each([
    { firstName: "  " },
    { lastName: "" },
    { phone: "555-1234" },
    { phone: "" },
    { facebookUrl: "https://instagram.com/jen" },
    { goodreadsUrl: "goodreads.com" },
    { instagram: "https://facebook.com/jen" },
    { instagram: "two words" },
    { venmo: "" },
  ])("rejects %j", (body) => {
    expect(UpdateProfileSchema.safeParse(body).success).toBe(false);
  });

  it("drops fields members can't change here", () => {
    expect(
      UpdateProfileSchema.parse({
        email: "new@example.com",
        image: "https://example.com/me.jpg",
        isAdmin: true,
        status: "ACTIVE",
      }),
    ).toEqual({});
  });
});
