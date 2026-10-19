import { getAllUsers } from "./users.service";
import { type Response, type Request } from "express";

export const userList = async (_req: Request, res: Response) => {
  const results = await getAllUsers();
  res.json(results);
};
