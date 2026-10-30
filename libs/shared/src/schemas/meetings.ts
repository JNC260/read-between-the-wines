import * as z from "zod";
import { BookSchema, SuggesterSchema } from "./books";
import { isoDate } from "./dates";
import { VenueSchema } from "./venues";

const requiredText = z.string().trim().min(1);

// The venue and book come along so lists and detail pages don't need a second request.
export const MeetingSchema = z.object({
  id: z.uuidv4(),
  title: z.string(),
  start: isoDate,
  end: isoDate,
  description: z.string().nullable(),
  craft: z.string().nullable(),
  venueId: z.uuidv4().nullable(),
  bookId: z.uuidv4().nullable(),
  // Set when an admin cancels it. A cancelled meeting stays listed, marked
  // cancelled, with no book and no new RSVPs.
  cancelledAt: isoDate.nullable(),
  venue: VenueSchema.nullable(),
  book: BookSchema.nullable(),
});

export type MeetingDTO = z.output<typeof MeetingSchema>;

const MeetingFieldsSchema = z.object({
  title: requiredText,
  start: isoDate,
  end: isoDate,
  description: z.string().trim().nullish(),
  craft: z.string().trim().nullish(),
  venueId: z.uuidv4().nullish(),
  bookId: z.uuidv4().nullish(),
});

// Zod won't .partial() a refined schema, so create and update both build on
// the plain fields. An update may send only one of start/end, so the service
// checks the order against the stored meeting instead.
export const CreateMeetingSchema = MeetingFieldsSchema.refine(
  (m) => m.end > m.start,
  { message: "End must be after start", path: ["end"] },
);

export type CreateMeetingDTO = z.output<typeof CreateMeetingSchema>;

// null clears an optional field; leaving it out keeps the current value.
export const UpdateMeetingSchema = MeetingFieldsSchema.partial();

export type UpdateMeetingDTO = z.output<typeof UpdateMeetingSchema>;

// GET /meetings?when=upcoming|past. Leaving it out returns every meeting.
export const MeetingListQuerySchema = z.object({
  when: z.enum(["upcoming", "past"]).optional(),
});

export type MeetingListQuery = z.infer<typeof MeetingListQuerySchema>;

// Mirrors the RsvpStatus enum in schema.prisma.
export const RsvpStatusSchema = z.enum(["YES", "MAYBE", "NO"]);

export type RsvpStatus = z.infer<typeof RsvpStatusSchema>;

// Enough for a big family, few enough to catch a typo like 22.
export const MAX_GUESTS = 10;

// PUT /meetings/:id/rsvp. Answering again replaces the member's status;
// dish and guestCount are kept unless sent, so the RSVP buttons can send
// just the status. Answering NO clears both.
export const SetRsvpSchema = z.object({
  status: RsvpStatusSchema,
  // What they're bringing to share. The service stores empty as null.
  dish: z.string().trim().max(100, "Keep it under 100 characters").nullish(),
  // People coming with them, not counting themselves.
  guestCount: z
    .int("Enter a whole number")
    .min(0, "Can't be negative")
    .max(MAX_GUESTS, `At most ${MAX_GUESTS} guests`)
    .optional(),
});

export type SetRsvpDTO = z.infer<typeof SetRsvpSchema>;

export const RsvpSchema = z.object({
  member: SuggesterSchema,
  status: RsvpStatusSchema,
  dish: z.string().nullable(),
  guestCount: z.int(),
});

export type RsvpDTO = z.output<typeof RsvpSchema>;

// GET /meetings/:id/rsvps, and what PUT /meetings/:id/rsvp returns.
export const MeetingRsvpsSchema = z.object({
  myStatus: RsvpStatusSchema.nullable(), // null until this member answers
  rsvps: z.array(RsvpSchema), // earliest answer first
});

export type MeetingRsvpsDTO = z.output<typeof MeetingRsvpsSchema>;
