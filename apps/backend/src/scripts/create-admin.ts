// Creates the first admin account. Sign-up is invite-only, so someone has to
// exist before anyone can be invited.
//
//   npx nx run backend:create-admin --email=you@example.com --first-name=Ada --last-name=Lovelace
//
// Against production, run it with the live service's variables so the
// password email goes out through Resend with links to the real site, and
// point DATABASE_URL at the Postgres service's public URL (its
// DATABASE_PUBLIC_URL in Railway), since the private one only works inside
// Railway:
//
//   railway run --service web -- env DATABASE_URL='<DATABASE_PUBLIC_URL>' \
//     npx nx run backend:create-admin --email=... --first-name=... --last-name=...
//
// Safe to run again: an existing account is only made a verified admin.
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { createInvite } from "../invites/invites.service";
import { auth } from "../lib/auth";
import { config, isProduction } from "../lib/config";
import { prisma } from "../lib/prisma";
import { databaseTarget, printDatabaseTarget } from "./database-target";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    "first-name": { type: "string" },
    "last-name": { type: "string" },
  },
});
// Better Auth lowercases emails at sign-up, so look them up the same way.
const email = values.email?.trim().toLowerCase();
const firstName = values["first-name"]?.trim();
const lastName = values["last-name"]?.trim();
if (!email || !firstName || !lastName) {
  console.error(
    "Usage: npx nx run backend:create-admin --email=<email> --first-name=<first> --last-name=<last>",
  );
  process.exit(1);
}

printDatabaseTarget();
console.log(
  `Password email: ${isProduction ? "Resend" : "Mailpit (local only)"}, with links to ${config.BETTER_AUTH_URL}`,
);

// The new admin sets a password from the reset email, so it has to reach
// them. Outside production it goes to Mailpit with a localhost link, which
// would leave a production account nobody can sign in to.
if (!databaseTarget.isLocal && !isProduction) {
  console.error(
    "Refusing to write to a remote database with local email settings. Run it with the live service's variables (see the comment at the top of this script).",
  );
  process.exit(1);
}

const makeVerifiedAdmin = (id: string) =>
  prisma.user.update({
    where: { id },
    data: { isAdmin: true, emailVerified: true },
  });

const main = async () => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await makeVerifiedAdmin(existing.id);
    console.log(`${email} already exists. It's now a verified admin; password unchanged.`);
    return;
  }

  // Sign-up is invite-only, so invite ourselves first (no inviter: null).
  const { token } = await createInvite(null);

  // Goes through Better Auth so the password is hashed its way and stored on
  // a "credential" Account row. A random password nobody knows is replaced
  // via the reset email below, so a real one never sits in a shell or file.
  // Sign-up also emails a verification link, which is harmless: we mark the
  // email verified below, since the reset link proves the inbox anyway.
  //
  // Built separately because Better Auth's types don't know about
  // inviteToken, though the endpoint accepts extra fields and passes them to
  // the sign-up hook. TypeScript only rejects unknown keys in inline objects.
  const body = {
    email,
    password: randomBytes(32).toString("base64url"),
    name: `${firstName} ${lastName}`,
    firstName,
    lastName,
    inviteToken: token,
  };
  const { user } = await auth.api.signUpEmail({ body });

  // isAdmin can't be set through sign-up (input: false), so set it directly.
  await makeVerifiedAdmin(user.id);

  await auth.api.requestPasswordReset({
    body: { email, redirectTo: "/reset-password" },
  });
  console.log(`Created ${email} as a verified admin. Check email for a link to set the password.`);
};

// No process.exit() on success: emails are sent in the background, and Node
// waits for them to finish before exiting.
main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
