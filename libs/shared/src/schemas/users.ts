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
  memberSince: z.int().nullable(), // a year
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

// The year they joined the club. Members set it themselves, since the club
// is older than the site and account creation dates would undersell it.
const memberSince = z
  .int("Enter a year, like 2019")
  .min(1900, "Enter a year, like 2019")
  .refine((year) => year <= new Date().getFullYear(), "That year hasn't happened yet");

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
  memberSince: memberSince.nullable().optional(),
});

export type UpdateProfileDTO = z.infer<typeof UpdateProfileSchema>;

// A member from the old Google Form who hasn't joined the site yet. The
// legacy import made them so their suggestions had someone to belong to;
// they can't sign in. Only admins see these.
export const PlaceholderSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  suggestionCount: z.int(),
});

export type PlaceholderDTO = z.output<typeof PlaceholderSchema>;

// Hands a placeholder's history to the member who turned out to be them.
export const MergePlaceholderSchema = z.object({
  memberId: z.uuid("Pick a member"),
});

export type MergePlaceholderDTO = z.infer<typeof MergePlaceholderSchema>;

// How many rows moved to the member. Ones they already had (the same book
// suggested twice, say) are dropped rather than counted.
export const MergeResultSchema = z.object({
  suggestions: z.int(),
  ratings: z.int(),
  rsvps: z.int(),
  votes: z.int(),
});

export type MergeResultDTO = z.output<typeof MergeResultSchema>;
