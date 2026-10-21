import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { UserStatus } from "../../generated/prisma/client";
import { type Email, sendEmail } from "./email";
import { prisma } from "./prisma";

// Not awaited, as Better Auth recommends: waiting on SMTP would make these
// requests measurably slower for real accounts than for unknown emails.
const sendInBackground = (email: Email) => {
  sendEmail(email).catch((err) => {
    console.error(`Failed to send "${email.subject}" to ${email.to}`, err);
  });
};

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
    sendResetPassword: async ({ user, url }) => {
      sendInBackground({
        to: user.email,
        subject: "Reset your Read Between the Wines password",
        html: `<p>Someone asked to reset your password. If it was you, <a href="${url}">choose a new one</a>.</p><p>If not, you can ignore this email.</p>`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      sendInBackground({
        to: user.email,
        subject: "Verify your email for Read Between the Wines",
        html: `<p>Welcome to the club! <a href="${url}">Verify your email</a> to finish signing up.</p>`,
      });
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
