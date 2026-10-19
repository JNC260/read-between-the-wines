import * as z from "zod";

// JSON has no Date type: dates travel as ISO strings and become Date objects
// again on the other side. z.encode() goes Date -> string, z.decode() goes
// string -> Date.
const isoDate = z.codec(z.iso.datetime(), z.date(), {
  decode: (s) => new Date(s),
  encode: (d) => d.toISOString(),
});

export const UserSchema = z.object({
  id: z.uuidv4(),
  email: z.email(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export type UserDTO = z.output<typeof UserSchema>;

// What a client may send. The server sets id and timestamps.
export const CreateUserSchema = UserSchema.pick({ email: true });

export type CreateUserDTO = z.infer<typeof CreateUserSchema>;
