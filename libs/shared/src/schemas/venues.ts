import * as z from "zod";

const requiredText = z.string().trim().min(1);

export const VenueSchema = z.object({
  id: z.uuidv4(),
  name: z.string(),
  streetAddress: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
});

export type VenueDTO = z.output<typeof VenueSchema>;

export const CreateVenueSchema = z.object({
  name: requiredText,
  streetAddress: requiredText,
  city: requiredText,
  state: requiredText,
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code"),
});

export type CreateVenueDTO = z.infer<typeof CreateVenueSchema>;

export const UpdateVenueSchema = CreateVenueSchema.partial();

export type UpdateVenueDTO = z.infer<typeof UpdateVenueSchema>;
