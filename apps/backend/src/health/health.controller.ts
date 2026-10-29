import { type Request, type Response } from "express";
import * as service from "./health.service";

export const getHealth = async (_req: Request, res: Response) => {
  await service.checkHealth();
  // A cached "ok" would hide an outage.
  res.set("Cache-Control", "no-store").json({ status: "ok" });
};
