import express from "express";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { CastVotesSchema, CreatePollSchema, UpdatePollSchema } from "shared";
import {
  castVotes,
  closePoll,
  createPoll,
  getCurrentPoll,
  getLatestPoll,
  getPoll,
  updatePoll,
} from "./polls.controller";

const router = express.Router();
router.use(requireAuth);

router.post("/", requireAdmin, validate(CreatePollSchema), createPoll);

router.get("/current", getCurrentPoll);
// The newest poll, open or closed: the landing page shows its results.
router.get("/latest", getLatestPoll);

router.get("/:id", getPoll);

router.patch("/:id", requireAdmin, validate(UpdatePollSchema), updatePoll);
router.post("/:id/close", requireAdmin, closePoll);

router.put("/:id/votes", validate(CastVotesSchema), castVotes);

export default router;
