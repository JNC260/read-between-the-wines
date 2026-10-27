import express from "express";
import {
  CreateMeetingSchema,
  SetRsvpSchema,
  UpdateMeetingSchema,
} from "shared";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createMeeting,
  getMeeting,
  getMeetingList,
  getRsvps,
  setRsvp,
  updateMeeting,
} from "./meetings.controller";

const router = express.Router();

router.use(requireAuth);

// ?when=upcoming|past; leave it out for every meeting.
router.get("/", getMeetingList);
router.get("/:id", getMeeting);
router.post("/", requireAdmin, validate(CreateMeetingSchema), createMeeting);
router.patch(
  "/:id",
  requireAdmin,
  validate(UpdateMeetingSchema),
  updateMeeting,
);
// Any member, for themselves.
router.get("/:id/rsvps", getRsvps);
router.put("/:id/rsvp", validate(SetRsvpSchema), setRsvp);

export default router;
