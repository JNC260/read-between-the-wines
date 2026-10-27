import { type ErrorRequestHandler } from "express";
import { AppError } from "../lib/errors";

// express.json() rejects malformed JSON with an error tagged this way.
const isJsonParseError = (err: unknown) =>
  err instanceof SyntaxError &&
  (err as { type?: string }).type === "entity.parse.failed";

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // TODO: the upload parser throws its own errors (with multer, a
  // MulterError with code LIMIT_FILE_SIZE for a file over the limit). Turn
  // those into a 400 here, or in middleware/upload.ts.

  if (isJsonParseError(err)) {
    res
      .status(400)
      .json({ error: { code: "BAD_REQUEST", message: "Malformed JSON body" } });
    return;
  }

  console.error(err);
  res
    .status(500)
    .json({ error: { code: "INTERNAL", message: "Internal Server Error" } });
};
