import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import { errorHandler } from "./middleware/error-handler";
import rootRoutes from "./root.routes";

export const app = express();

// Better Auth reads the raw request body itself, so it has to be mounted
// before express.json(). *splat is Express 5's named wildcard.
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.use("/api", rootRoutes);

app.use(errorHandler);
