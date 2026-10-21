import * as z from "zod";
import { isoDate } from "./dates";
import { VenueSchema } from "./venues";

const requiredText = z.string().trim().min(1);

// The venue comes along so lists and detail pages don't need a second request.
export const MeetingSchema = z.object({
  id: z.uuidv4(),
  title: z.string(),
  start: isoDate,
  end: isoDate,
  description: z.string().nullable(),
  venueId: z.uuidv4().nullable(),
  bookId: z.uuidv4().nullable(),
  venue: VenueSchema.nullable(),
});

export type MeetingDTO = z.output<typeof MeetingSchema>;

const MeetingFieldsSchema = z.object({
  title: requiredText,
  start: isoDate,
  end: isoDate,
  description: z.string().trim().nullish(),
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
