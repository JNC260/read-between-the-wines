// Sign-up tests through Better Auth itself, run against a real test
// database with
//   npx nx test-db backend
import { createInvite } from "../invites/invites.service";
import { createBook, resetDb } from "../test/db";
import { auth } from "./auth";
import { type Email } from "./email";
import { prisma } from "./prisma";

// Catches the verification email instead of sending it.
const sent: Email[] = [];
vi.mock("./email", () => ({
  sendEmail: async (email: Email) => {
    sent.push(email);
  },
}));

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
  sent.length = 0;
});

const signUp = async (firstName: string, lastName: string) => {
  const { token } = await createInvite(null);
  const email = `${firstName.toLowerCase()}@example.com`;
  await auth.api.signUpEmail({
    body: {
      email,
      password: "a long enough password",
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      inviteToken: token,
    } as never,
  });
  return prisma.user.findUniqueOrThrow({ where: { email } });
};

// The link in the email is /api/auth/verify-email?token=...
const verify = async (to: string) => {
  const email = sent.find((e) => e.to === to);
  const link = email?.html.match(/href="([^"]+)"/)?.[1];
  const token = link && new URL(link).searchParams.get("token");
  if (!token) {
    throw new Error(`No verification link was sent to ${to}`);
  }
  await auth.api.verifyEmail({ query: { token } });
};

describe("claiming a placeholder", () => {
  it("gives a new member their legacy suggestions once they verify", async () => {
    const placeholder = await prisma.user.create({
      data: {
        name: "Haylie Reader",
        firstName: "Haylie",
        lastName: "Reader",
        email: "placeholder+haylie@example.invalid",
        status: "INACTIVE",
      },
    });
    const book = await createBook({ suggestedBy: placeholder.id });

    const haylie = await signUp("Haylie", "Reader");
    // Not before: an unverified email could belong to anyone.
    expect(await prisma.suggestion.count({ where: { userId: haylie.id } })).toBe(0);

    await verify(haylie.email);
    const suggestions = await prisma.suggestion.findMany({
      where: { userId: haylie.id },
    });
    expect(suggestions.map((s) => s.bookId)).toEqual([book.id]);
    expect(await prisma.user.count({ where: { id: placeholder.id } })).toBe(0);
  });
});
