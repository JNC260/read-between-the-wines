import express from "express";
import {
  requireAdmin,
  requireAuth,
  requireAuthAllowInactive,
} from "../middleware/auth";
import {
  userDeactivate,
  userDeactivateSelf,
  userList,
  userReactivateSelf,
} from "./users.controller";

const router = express.Router();

// Sign-up lives at /api/auth/sign-up/email (Better Auth).
router.get("/", requireAuth, userList);

// /me routes come before /:id, or "me" would be read as an id.
router.post("/me/deactivate", requireAuth, userDeactivateSelf);
router.post("/me/reactivate", requireAuthAllowInactive, userReactivateSelf);
router.post("/:id/deactivate", requireAuth, requireAdmin, userDeactivate);

export default router;
