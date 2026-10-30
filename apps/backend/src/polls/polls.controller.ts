import { type Request, type Response } from "express";
import {
  CurrentPollSchema,
  PollSchema,
  type CastVotesDTO,
  type CreatePollDTO,
  type UpdatePollDTO,
} from "shared";
import * as service from "./polls.service";
import * as z from "zod";
import { UnauthorizedError } from "../lib/errors";

type Params = { id: string };

// POST /polls -> 201
export const createPoll = async (
  req: Request<Record<string, string>, unknown, CreatePollDTO>,
  res: Response,
) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const poll = await service.createPoll(req.body);
  res.status(201).json(z.encode(PollSchema, poll));
};

// GET /polls/current -> the open poll, or null
export const getCurrentPoll = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const currentPoll = await service.getCurrentPoll(req.user.id);
  if (currentPoll) {
    res.json(z.encode(CurrentPollSchema, currentPoll));
  } else {
    res.json(null);
  }
};

// GET /polls/:id
export const getPoll = async (req: Request<Params>, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const poll = await service.getPoll(req.params.id, req.user.id);
  if (poll) {
    res.json(z.encode(PollSchema, poll));
  } else {
    res.json(null);
  }
};

// PUT /polls/:id/votes -> the updated poll
export const castVotes = async (
  req: Request<Params, unknown, CastVotesDTO>,
  res: Response,
) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const pollWithVotes = await service.castVotes(
    req.params.id,
    req.user.id,
    req.body,
  );
  res.json(z.encode(PollSchema, pollWithVotes));
};

// GET /polls/latest -> the newest poll, open or closed, or null
export const getLatestPoll = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const poll = await service.getLatestPoll(req.user.id);
  res.json(z.encode(CurrentPollSchema, poll));
};

// PATCH /polls/:id (admins) -> the updated poll
export const updatePoll = async (
  req: Request<Params, unknown, UpdatePollDTO>,
  res: Response,
) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const poll = await service.updatePoll(req.params.id, req.user.id, req.body);
  res.json(z.encode(PollSchema, poll));
};

// POST /polls/:id/close (admins) -> the closed poll, with its results
export const closePoll = async (req: Request<Params>, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const poll = await service.closePoll(req.params.id, req.user.id);
  res.json(z.encode(PollSchema, poll));
};
