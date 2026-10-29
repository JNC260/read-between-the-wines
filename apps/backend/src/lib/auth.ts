import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { UserStatus } from "../../generated/prisma/client";
import { config, isProduction } from "./config";
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

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // Passed explicitly so they're validated by lib/config first. baseURL is
  // what verification and reset links point at.
  secret: config.BETTER_AUTH_SECRET,
  baseURL: config.BETTER_AUTH_URL,
  // Sign-in and sign-up only accepted from the site itself. Locally that's
  // Vite's origin, which proxies /api; in production, the one service.
  trustedOrigins: [config.BETTER_AUTH_URL],
  advanced: {
    // Our UserSchema expects UUID ids; Better Auth's default ids aren't.
    database: { generateId: "uuid" },
    // HTTPS-only cookies in production. Locally the site is plain http, and
    // browsers would drop them.
    useSecureCookies: isProduction,
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
    // Sign-up is invite-only: the body must include the inviteToken from a
    // member's invite link. Runs for every way a user is created, so the
    // create-admin script goes through it too.
    user: {
      create: {
        before: async (_user, ctx) => {
          const token = ctx?.body?.inviteToken;
          if (typeof token !== "string" || !(await isInviteValid(token))) {
            // 400, not 403: Better Auth turns a 403 here into its fake
            // "success" response for duplicate emails, hiding the error.
            throw new APIError("BAD_REQUEST", {
              message: "This invite link is invalid or has expired",
              code: "INVITE_INVALID",
            });
          }
          // The token only shows a member vouched for them. It says nothing
          // about the email (the inviter saw the link too), so they still
          // verify it like anyone else.
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
    // Logging in before verifying sends a fresh link, since this one expires
    // after an hour.
    sendOnSignIn: true,
    // Clicking the link signs them in, so a new member goes straight from
    // the email to the club without typing their password again.
    autoSignInAfterVerification: true,
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
