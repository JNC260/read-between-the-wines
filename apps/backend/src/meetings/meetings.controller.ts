import { type Request, type Response } from "express";
import * as z from "zod";
import {
  type CreateMeetingDTO,
  MeetingListQuerySchema,
  MeetingSchema,
  type UpdateMeetingDTO,
} from "shared";
import { BadRequestError } from "../lib/errors";
import * as service from "./meetings.service";

type Params = { id: string };

// validate() only covers bodies, and Express 5's req.query can't be
// reassigned, so the query string is parsed here.
export const getMeetingList = async (req: Request, res: Response) => {
  const query = MeetingListQuerySchema.safeParse(req.query);
  if (!query.success) {
    throw new BadRequestError("Invalid query", z.flattenError(query.error));
  }
  const meetings = await service.getAllMeetings(query.data);
  res.json(z.encode(MeetingSchema.array(), meetings));
};

export const getMeeting = async (req: Request<Params>, res: Response) => {
  const meeting = await service.getMeeting(req.params.id);
  res.json(z.encode(MeetingSchema, meeting));
};

export const createMeeting = async (
  req: Request<Record<string, string>, unknown, CreateMeetingDTO>,
  res: Response,
) => {
  const meeting = await service.createMeeting(req.body);
  res.status(201).json(z.encode(MeetingSchema, meeting));
};

export const updateMeeting = async (
  req: Request<Params, unknown, UpdateMeetingDTO>,
  res: Response,
) => {
  const meeting = await service.updateMeeting(req.params.id, req.body);
  res.json(z.encode(MeetingSchema, meeting));
};
