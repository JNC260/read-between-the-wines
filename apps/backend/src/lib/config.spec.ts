import path from "node:path";
import { parseConfig } from "./config";

const SECRET = "s".repeat(32);

const valid = {
  DATABASE_URL: "postgresql://rbtw:pw@localhost:5432/rbtw",
  BETTER_AUTH_SECRET: SECRET,
  BETTER_AUTH_URL: "http://localhost:4200",
  EMAIL_FROM: "Read Between the Wines <hello@example.org>",
  SMTP_HOST: "localhost",
  SMTP_PORT: "1025",
};

// No SMTP settings: production sends through Resend.
const withoutSmtp = { ...valid, SMTP_HOST: undefined, SMTP_PORT: undefined };
const production = {
  ...withoutSmtp,
  NODE_ENV: "production",
  BETTER_AUTH_URL: "https://readbetweenthewinespaducah.org",
  RESEND_API_KEY: "re_123",
};

const problems = (env: Record<string, string | undefined>) => {
  try {
    parseConfig(env);
    return "";
  } catch (e) {
    return (e as Error).message;
  }
};

describe("parseConfig", () => {
  it("defaults NODE_ENV and PORT for local development", () => {
    expect(parseConfig(valid)).toMatchObject({ NODE_ENV: "development", PORT: 3333 });
  });

  it("reads PORT as a number, as Railway sets it", () => {
    expect(parseConfig({ ...valid, PORT: "8080" }).PORT).toBe(8080);
  });

  it("drops a trailing slash from BETTER_AUTH_URL so links don't get //", () => {
    expect(
      parseConfig({ ...valid, BETTER_AUTH_URL: "https://example.org/" }).BETTER_AUTH_URL,
    ).toBe("https://example.org");
  });

  it("makes UPLOAD_DIR absolute, defaulting to uploads/ where the server starts", () => {
    expect(parseConfig(valid).UPLOAD_DIR).toBe(path.resolve("uploads"));
    expect(parseConfig({ ...valid, UPLOAD_DIR: "/data/uploads" }).UPLOAD_DIR).toBe(
      "/data/uploads",
    );
  });

  it("accepts a production setup", () => {
    expect(parseConfig(production)).toMatchObject({ NODE_ENV: "production" });
  });

  it("names every missing variable at once", () => {
    const message = problems({});
    for (const name of ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "EMAIL_FROM"]) {
      expect(message).toContain(name);
    }
  });

  it.each([
    ["a non-Postgres DATABASE_URL", { DATABASE_URL: "mysql://localhost/rbtw" }, "DATABASE_URL"],
    ["a short secret", { BETTER_AUTH_SECRET: "short" }, "BETTER_AUTH_SECRET"],
    ["a non-numeric PORT", { PORT: "eighty" }, "PORT"],
    ["an unknown NODE_ENV", { NODE_ENV: "staging" }, "NODE_ENV"],
    ["a key that isn't Resend's", { RESEND_API_KEY: "sk_123" }, "RESEND_API_KEY"],
  ])("rejects %s", (_, overrides, name) => {
    expect(problems({ ...valid, ...overrides })).toContain(name);
  });

  it("reads the Mailpit settings, with SMTP_SECURE as a boolean", () => {
    expect(parseConfig({ ...valid, SMTP_SECURE: "true" })).toMatchObject({
      SMTP_HOST: "localhost",
      SMTP_PORT: 1025,
      SMTP_SECURE: true,
    });
    expect(parseConfig(valid).SMTP_SECURE).toBe(false);
  });

  it("treats an empty variable as unset, like RESEND_API_KEY= in .env", () => {
    const config = parseConfig({ ...valid, RESEND_API_KEY: "", SMTP_USER: "" });
    expect(config.RESEND_API_KEY).toBeUndefined();
    expect(config.SMTP_USER).toBeUndefined();
    expect(problems({ ...valid, DATABASE_URL: "" })).toContain("DATABASE_URL");
  });

  it("requires the Mailpit settings outside production", () => {
    const message = problems(withoutSmtp);
    expect(message).toContain("SMTP_HOST: Required outside production");
    expect(message).toContain("SMTP_PORT: Required outside production");
  });

  it("requires a Resend key and an https site in production", () => {
    const message = problems({
      ...production,
      RESEND_API_KEY: undefined,
      BETTER_AUTH_URL: "http://readbetweenthewinespaducah.org",
    });
    expect(message).toContain("RESEND_API_KEY: Required in production");
    expect(message).toContain("BETTER_AUTH_URL: Must be https:// in production");
  });

  it("never prints a variable's value", () => {
    const message = problems({ ...valid, BETTER_AUTH_SECRET: "hunter2-not-long-enough" });
    expect(message).toContain("BETTER_AUTH_SECRET");
    expect(message).not.toContain("hunter2");
  });
});
