import * as z from "zod";

// JSON has no Date type: dates travel as ISO strings and become Date objects
// again on the other side. z.encode() goes Date -> string, z.decode() goes
// string -> Date.
const isoDate = z.codec(z.iso.datetime(), z.date(), {
  decode: (s) => new Date(s),
  encode: (d) => d.toISOString(),
});

// Mirrors the UserStatus enum in schema.prisma. Kept separate so the frontend
// doesn't depend on Prisma; getAllUsers() stops compiling if they drift.
export const UserStatusSchema = z.enum(["ACTIVE", "INACTIVE", "BANNED"]);

// What any member may see about another member. z.encode() drops fields not
// listed here, so isAdmin and emailVerified never leave the server.
export const UserSchema = z.object({
  id: z.uuidv4(),
  email: z.email(),
  name: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  image: z.string().nullable(),
  status: UserStatusSchema,
  createdAt: isoDate,
  updatedAt: isoDate,
});

export type UserDTO = z.output<typeof UserSchema>;
