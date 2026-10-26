import express from "express";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { CastVotesSchema, CreatePollSchema } from "shared";
import {
  castVotes,
  createPoll,
  getCurrentPoll,
  getPoll,
} from "./polls.controller";

const router = express.Router();
router.use(requireAuth);

router.post("/", requireAdmin, validate(CreatePollSchema), createPoll);

router.get("/current", getCurrentPoll);

router.get("/:id", getPoll);

router.put("/:id/votes", validate(CastVotesSchema), castVotes);

export default router;
