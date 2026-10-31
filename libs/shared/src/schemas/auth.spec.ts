import * as z from "zod";
import { ResetPasswordSchema, SignInSchema, SignUpSchema } from "./auth";

const fieldErrors = (result: { error?: z.ZodError }) =>
  result.error ? z.flattenError(result.error).fieldErrors : {};

describe("SignInSchema", () => {
  it("doesn't hold old passwords to the new length rules", () => {
    expect(SignInSchema.safeParse({ email: "a@example.com", password: "short" }).success).toBe(
      true,
    );
  });

  it("asks for a real email and a password", () => {
    expect(fieldErrors(SignInSchema.safeParse({ email: "nope", password: "" }))).toEqual({
      email: ["Enter an email address, like you@example.com"],
      password: ["Enter your password"],
    });
  });
});

describe("ResetPasswordSchema", () => {
  it("puts a mismatch on the confirm field", () => {
    expect(
      fieldErrors(ResetPasswordSchema.safeParse({ password: "long-enough", confirm: "different" })),
    ).toEqual({ confirm: ["Passwords don't match."] });
  });

  it("enforces Better Auth's minimum length", () => {
    expect(
      fieldErrors(ResetPasswordSchema.safeParse({ password: "short", confirm: "short" })),
    ).toMatchObject({ password: ["Use at least 8 characters"] });
  });
});

describe("SignUpSchema", () => {
  it("trims names and requires them", () => {
    const valid = {
      email: "a@example.com",
      firstName: " Ada ",
      lastName: "Lovelace",
      password: "long-enough",
      confirm: "long-enough",
    };
    expect(SignUpSchema.parse(valid).firstName).toBe("Ada");
    expect(fieldErrors(SignUpSchema.safeParse({ ...valid, lastName: "  " }))).toEqual({
      lastName: ["Required"],
    });
  });
});
