import express from "express";
import { errorHandler } from "./middleware/error-handler";
import rootRoutes from "./root.routes";

export const app = express();

app.use(express.json());

app.use("/api", rootRoutes);

app.use(errorHandler);
