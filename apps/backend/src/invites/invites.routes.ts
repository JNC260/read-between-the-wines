import express from "express";
import { CreateInviteSchema } from "shared";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  inviteCreate,
  inviteList,
  inviteLookup,
  inviteRevoke,
} from "./invites.controller";

const router = express.Router();

// Public: the invite page looks up its link before the invitee has an
// account. Registered before the admin check below so it isn't blocked.
router.get("/:token", inviteLookup);

// Everything else is admin-only for now.
router.use(requireAuth, requireAdmin);

router.get("/", inviteList);
router.post("/", validate(CreateInviteSchema), inviteCreate);
router.delete("/:id", inviteRevoke);

export default router;
