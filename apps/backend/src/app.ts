import express, { type ErrorRequestHandler } from "express";
import rootRoutes from "./root.routes";

export const app = express();

app.use("/", rootRoutes);

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: "Internal Server Error" });
};
app.use(errorHandler);
