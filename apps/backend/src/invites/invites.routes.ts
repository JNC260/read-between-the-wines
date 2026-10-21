import express from "express";
import { CreateInviteSchema } from "shared";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { inviteCreate, inviteList, inviteRevoke } from "./invites.controller";

const router = express.Router();

// Inviting is admin-only for now.
router.use(requireAuth, requireAdmin);

router.get("/", inviteList);
router.post("/", validate(CreateInviteSchema), inviteCreate);
router.delete("/:id", inviteRevoke);

export default router;
