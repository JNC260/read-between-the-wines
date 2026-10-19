import * as z from "zod";

export const UserSchema = z.object({
  email: z.email(),
  id: z.uuidv4(),
});

export type UserDTO = z.infer<typeof UserSchema>;
