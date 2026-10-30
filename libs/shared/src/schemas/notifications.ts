import * as z from "zod";

// The emails members can turn off, one switch each. Account emails, like
// password resets, always send.
export const NOTIFICATION_KINDS = [
  "NEW_POLL",
  "VOTE_REMINDER",
  "RSVP_REMINDER",
  "MEETING_REMINDER",
] as const;

export const NotificationKindSchema = z.enum(NOTIFICATION_KINDS);

export type NotificationKind = z.output<typeof NotificationKindSchema>;

// How each switch is labelled on the profile page and the unsubscribe page.
export const NOTIFICATION_LABELS: Record<NotificationKind, string> = {
  NEW_POLL: "A new book poll opens",
  VOTE_REMINDER: "A day before a poll closes, if I haven't voted",
  RSVP_REMINDER: "A day before a meeting, if I haven't RSVP'd",
  MEETING_REMINDER: "A day before a meeting I'm going to",
};

// GET and PUT /users/me/notifications: the emails this member has turned
// off. Only they see it, unlike the profile, which every member can. PUT
// sends the whole list: anything left out is turned back on.
export const EmailSettingsSchema = z.object({
  emailOptOuts: z
    .array(NotificationKindSchema)
    .refine((k) => new Set(k).size === k.length, "Each kind only once"),
});

export type EmailSettingsDTO = z.output<typeof EmailSettingsSchema>;

// POST /notifications/unsubscribe?u=&k=&t= (public). The link in every
// notification email, signed so it only works for that member. k is one
// kind, or ALL for every notification email.
export const UnsubscribeQuerySchema = z.object({
  u: z.uuid(),
  k: z.union([NotificationKindSchema, z.literal("ALL")]),
  t: z.string().min(1),
});

export type UnsubscribeQuery = z.output<typeof UnsubscribeQuerySchema>;
