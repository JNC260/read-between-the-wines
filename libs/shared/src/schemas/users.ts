import * as z from "zod";
import { normalizePhone } from "../lib/phone";
import {
  HANDLE_PATTERN,
  type HandleSite,
  isProfileUrl,
  parseHandle,
  parseProfileUrl,
  type ProfileUrlSite,
} from "../lib/social";
import { isoDate } from "./dates";

// Mirrors the UserStatus enum in schema.prisma. Kept separate so the frontend
// doesn't depend on Prisma; getActiveUsers() stops compiling if they drift.
export const UserStatusSchema = z.enum(["ACTIVE", "INACTIVE", "BANNED"]);

// What any member may see about another member. z.encode() drops fields not
// listed here, so isAdmin and emailVerified never leave the server. The
// contact fields are optional; members who'd rather not share one leave it
// empty. phone is E.164 (+15551234567); show it with formatPhone().
export const UserSchema = z.object({
  id: z.uuidv4(),
  email: z.email(),
  name: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  image: z.string().nullable(),
  phone: z.string().nullable(),
  facebookUrl: z.string().nullable(),
  goodreadsUrl: z.string().nullable(),
  instagram: z.string().nullable(),
  tiktok: z.string().nullable(),
  x: z.string().nullable(),
  venmo: z.string().nullable(),
  status: UserStatusSchema,
  createdAt: isoDate,
  updatedAt: isoDate,
});

export type UserDTO = z.output<typeof UserSchema>;

// The messages show next to each field on the profile form.
const requiredText = z.string().trim().min(1, "Required");

// .overwrite() rather than .transform(), so the frontend can z.encode() the
// form values too. Each rewrite leaves bad input as it was for the check
// after it to reject.
const handle = (site: HandleSite, label: string) =>
  z
    .string()
    .overwrite((value) => parseHandle(site, value))
    .regex(HANDLE_PATTERN, `Enter your ${label} username or profile link`);

const profileUrl = (site: ProfileUrlSite, label: string) =>
  z
    .string()
    .overwrite((value) => parseProfileUrl(site, value))
    .refine((value) => isProfileUrl(site, value), `Enter a link to your ${label} profile`);

const phone = z
  .string()
  .overwrite((value) => normalizePhone(value) ?? value)
  .regex(/^\+1\d{10}$/, "Enter a 10-digit US phone number");

// PATCH semantics: leave a field out to keep it, send null to clear it.
// Email is changed through Better Auth (it has to be re-verified), and the
// image will get its own upload endpoint.
export const UpdateProfileSchema = z.object({
  firstName: requiredText.optional(),
  lastName: requiredText.optional(),
  phone: phone.nullable().optional(),
  facebookUrl: profileUrl("facebook", "Facebook").nullable().optional(),
  goodreadsUrl: profileUrl("goodreads", "Goodreads").nullable().optional(),
  instagram: handle("instagram", "Instagram").nullable().optional(),
  tiktok: handle("tiktok", "TikTok").nullable().optional(),
  x: handle("x", "X").nullable().optional(),
  venmo: handle("venmo", "Venmo").nullable().optional(),
});

export type UpdateProfileDTO = z.infer<typeof UpdateProfileSchema>;
