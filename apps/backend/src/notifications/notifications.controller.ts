import { type Request, type Response } from "express";
import * as z from "zod";
import { UnsubscribeQuerySchema } from "shared";
import { BadRequestError } from "../lib/errors";
import * as service from "./notifications.service";

// POST /notifications/unsubscribe?u=&k=&t= -> 204. The query string carries
// everything, since mail apps' one-click unsubscribe POSTs to the URL as is.
export const unsubscribe = async (req: Request, res: Response) => {
  const query = UnsubscribeQuerySchema.safeParse(req.query);
  if (!query.success) {
    throw new BadRequestError("Invalid unsubscribe link", z.flattenError(query.error));
  }
  await service.unsubscribe(query.data);
  res.status(204).end();
};
