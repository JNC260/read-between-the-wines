import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { UserStatus } from "../../generated/prisma/client";
import { prisma } from "./prisma";

// BETTER_AUTH_SECRET and BETTER_AUTH_URL are read from the environment.
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  advanced: {
    // Our UserSchema expects UUID ids; Better Auth's default ids aren't.
    database: { generateId: "uuid" },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    // TODO: send a real email. Until then, copy the link from the server log.
    sendVerificationEmail: async ({ user, url }) => {
      console.log(`Verify ${user.email}: ${url}`);
    },
  },
  user: {
    additionalFields: {
      firstName: { type: "string", required: true },
      lastName: { type: "string", required: true },
      // input: false means sign-up can't set these; only the server can.
      status: {
        type: Object.values(UserStatus),
        required: false,
        defaultValue: UserStatus.ACTIVE,
        input: false,
      },
      isAdmin: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
});
