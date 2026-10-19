import * as z from "zod";

export const User = z.object({
  email: z.email(),
  id: z.uuidv4(),
});

export type User = z.infer<typeof User>;
