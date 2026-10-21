import * as z from "zod";
import { isoDate } from "./dates";

// What an admin sees about an invite. The token itself is only ever in the
// email; the server keeps just its hash.
export const InviteSchema = z.object({
  id: z.uuidv4(),
  email: z.email(),
  expiresAt: isoDate,
  usedAt: isoDate.nullable(),
  createdAt: isoDate,
});

export type InviteDTO = z.output<typeof InviteSchema>;

export const CreateInviteSchema = z.object({
  email: z.email(),
});

export type CreateInviteDTO = z.infer<typeof CreateInviteSchema>;
