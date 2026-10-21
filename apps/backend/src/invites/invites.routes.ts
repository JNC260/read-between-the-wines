import express from "express";
import { requireAdmin, requireAuth } from "../middleware/auth";
import {
  inviteCreate,
  inviteList,
  inviteLookup,
  inviteRevoke,
} from "./invites.controller";

const router = express.Router();

// Public: the invite page looks up its link before the invitee has an
// account. Registered before the checks below so it isn't blocked.
router.get("/:token", inviteLookup);

// Any signed-in member can make an invite link. No body.
router.post("/", requireAuth, inviteCreate);

// Everything else is admin-only for now.
router.use(requireAuth, requireAdmin);

router.get("/", inviteList);
router.delete("/:id", inviteRevoke);

export default router;
