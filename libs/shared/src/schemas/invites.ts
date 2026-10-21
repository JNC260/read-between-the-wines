import * as z from "zod";
import { isoDate } from "./dates";

// What an admin sees about an invite. Invites aren't tied to an email: the
// link shows a member vouched for whoever has it, and the invitee proves
// their email separately by verifying it. The server keeps just the token's
// hash; the raw token is only returned once, to the member who created it.
export const InviteSchema = z.object({
  id: z.uuidv4(),
  expiresAt: isoDate,
  usedAt: isoDate.nullable(),
  createdAt: isoDate,
});

export type InviteDTO = z.output<typeof InviteSchema>;

// Returned only when an invite is created, so the member can share the
// sign-up link. It can't be fetched again later.
export const CreatedInviteSchema = InviteSchema.extend({
  url: z.url(),
});

export type CreatedInviteDTO = z.output<typeof CreatedInviteSchema>;

// Public lookup for the invite page, so it can tell an expired link from a
// good one before asking for details.
export const InviteLookupSchema = z.object({
  expiresAt: isoDate,
});

export type InviteLookupDTO = z.output<typeof InviteLookupSchema>;
