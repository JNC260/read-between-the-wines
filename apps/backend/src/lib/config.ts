import * as z from "zod";

// Every environment variable the server reads, checked once at startup, so a
// missing or mistyped one stops the process with a clear message instead of
// breaking the first request that needs it. Locally these come from the root
// .env (Nx loads it); on Railway, from the service's variables.

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3333),
    DATABASE_URL: z.url({
      protocol: /^postgres(ql)?$/,
      error: "Must be a postgresql:// connection string",
    }),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "Must be at least 32 characters; generate one with `openssl rand -base64 32`"),
    // The origin members see in the address bar, like
    // https://readbetweenthewinespaducah.org. Invite and email links are
    // built from it, so no trailing slash.
    BETTER_AUTH_URL: z
      .url({ protocol: /^https?$/, error: "Must be an http(s) URL" })
      .transform((url) => url.replace(/\/+$/, "")),
    // Production email goes through Resend's HTTP API.
    RESEND_API_KEY: z.string().startsWith("re_", "Resend keys start with re_").optional(),
    EMAIL_FROM: z.string().trim().min(1, "Required, like: Read Between the Wines <hello@example.org>"),
    // Everywhere else, email goes over SMTP to Mailpit (inbox at
    // http://localhost:8025). Unused in production.
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).optional(),
    // true for port 465 (TLS from the start); false lets 587 upgrade via STARTTLS.
    SMTP_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    // Mailpit needs no login, so these are usually empty.
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") {
      for (const name of ["SMTP_HOST", "SMTP_PORT"] as const) {
        if (env[name] === undefined) {
          ctx.addIssue({
            code: "custom",
            path: [name],
            message: "Required outside production, for Mailpit (see .env.example)",
          });
        }
      }
      return;
    }
    if (!env.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "Required in production",
      });
    }
    // Secure cookies only work over HTTPS.
    if (!env.BETTER_AUTH_URL.startsWith("https://")) {
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_URL"],
        message: "Must be https:// in production",
      });
    }
  });

export type Config = z.output<typeof EnvSchema>;

// Exported for tests; everything else imports `config`.
export const parseConfig = (env: Record<string, string | undefined>): Config => {
  // An empty line in .env (RESEND_API_KEY=) means "not set", not "".
  const set = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ""));
  const result = EnvSchema.safeParse(set);
  if (!result.success) {
    // Names only, never values: these are secrets.
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(env)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${problems}`);
  }
  return result.data;
};

export const config = parseConfig(process.env);

export const isProduction = config.NODE_ENV === "production";
