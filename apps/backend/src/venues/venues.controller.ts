import { type Request, type Response } from "express";
import * as z from "zod";
import { type CreateVenueDTO, type UpdateVenueDTO, VenueSchema } from "shared";
import * as service from "./venues.service";

type Params = { id: string };

export const getVenueList = async (_req: Request, res: Response) => {
  const venues = await service.getAllVenues();
  res.json(z.encode(VenueSchema.array(), venues));
};

export const getVenue = async (req: Request<Params>, res: Response) => {
  const venue = await service.getVenue(req.params.id);
  res.json(z.encode(VenueSchema, venue));
};

export const createVenue = async (
  req: Request<Record<string, string>, unknown, CreateVenueDTO>,
  res: Response,
) => {
  const venue = await service.createVenue(req.body);
  res.status(201).json(z.encode(VenueSchema, venue));
};

export const updateVenue = async (
  req: Request<Params, unknown, UpdateVenueDTO>,
  res: Response,
) => {
  const venue = await service.updateVenue(req.params.id, req.body);
  res.json(z.encode(VenueSchema, venue));
};
