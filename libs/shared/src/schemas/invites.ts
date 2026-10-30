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

// GET /invites (admins): the links nobody has used yet that still work.
// Only a hash of each link is stored, so the link itself can't be shown
// again; an admin can revoke one and make a new one instead.
export const OpenInviteSchema = InviteSchema.extend({
  invitedBy: z.object({ firstName: z.string(), lastName: z.string() }).nullable(),
});

export type OpenInviteDTO = z.output<typeof OpenInviteSchema>;

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
