import { type Request, type Response } from "express";
import * as service from "./covers.service";

// GET /covers/:file -> the cover image. A cover never changes under its
// name, so browsers can keep it for good.
export const getCover = async (req: Request<{ file: string }>, res: Response) => {
  const file = await service.coverFile(req.params.file);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.type("jpg").sendFile(file);
};
