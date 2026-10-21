import { type RequestHandler } from "express";
import * as z from "zod";
import { BadRequestError } from "../lib/errors";

// A failed parse here is the client's fault, so it becomes a 400. ZodErrors
// thrown anywhere else (like z.encode() on our own data) are server bugs and
// fall through to a 500.
export const validate =
  (schema: z.ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new BadRequestError("Invalid request", z.flattenError(result.error)));
      return;
    }
    req.body = result.data;
    next();
  };
