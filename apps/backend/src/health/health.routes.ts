import express from "express";
import { getHealth } from "./health.controller";

const router = express.Router();

// Public: Railway calls it before sending traffic to a new deploy, and it
// isn't signed in.
router.get("/", getHealth);

export default router;
