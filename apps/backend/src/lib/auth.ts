import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { UserStatus } from "../../generated/prisma/client";
import { isInviteValid, markInviteUsed } from "../invites/invites.service";
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
  databaseHooks: {
    // Sign-up is invite-only: the body must include the inviteToken from the
    // invite email, for exactly this email. Runs for every way a user is
    // created, so the create-admin script goes through it too.
    user: {
      create: {
        before: async (user, ctx) => {
          const token = ctx?.body?.inviteToken;
          if (typeof token !== "string" || !(await isInviteValid(token, user.email))) {
            // 400, not 403: Better Auth turns a 403 here into its fake
            // "success" response for duplicate emails, hiding the error.
            throw new APIError("BAD_REQUEST", {
              message: "This invite link is invalid or has expired",
              code: "INVITE_INVALID",
            });
          }
          // The token arrived by email, so they've already proved they can
          // read this inbox. No separate verification step needed.
          return { data: { ...user, emailVerified: true } };
        },
        after: async (_user, ctx) => {
          await markInviteUsed(ctx?.body?.inviteToken);
        },
      },
    },
    session: {
      create: {
        // Banned users can't sign in at all. requireAuth also rejects them,
        // but without this they'd still get a session that works on Better
        // Auth's own endpoints, like change-password.
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { status: true },
          });
          if (user?.status === UserStatus.BANNED) {
            throw new APIError("FORBIDDEN", {
              message: "This account has been banned",
              code: "ACCOUNT_BANNED",
            });
          }
        },
      },
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      // Better Auth sends this after every sign-up, but invited members are
      // verified by the sign-up hook above.
      if (user.emailVerified) {
        return;
      }
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
