import express, { type Express, type Request, type Response } from "express";
import app from "../main";

app.get("/users", (req: Request, res: Response) => {
  console.log("REQ", req);
  console.log("RES", res);
  return [];
});
