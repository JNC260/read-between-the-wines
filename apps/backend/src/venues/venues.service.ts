import {
  type CreateVenueDTO,
  type UpdateVenueDTO,
  type VenueDTO,
} from "shared";
import { NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";

export const getAllVenues = (): Promise<VenueDTO[]> => {
  return prisma.venue.findMany({ orderBy: { name: "asc" } });
};

export const getVenue = async (id: string): Promise<VenueDTO> => {
  const venue = await prisma.venue.findUnique({ where: { id } });
  if (!venue) {
    throw new NotFoundError("Venue not found");
  }
  return venue;
};

export const createVenue = (data: CreateVenueDTO): Promise<VenueDTO> => {
  return prisma.venue.create({ data });
};

export const updateVenue = async (
  id: string,
  data: UpdateVenueDTO,
): Promise<VenueDTO> => {
  await getVenue(id);
  return prisma.venue.update({ where: { id }, data });
};
