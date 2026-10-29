import express from "express";
import { MergePlaceholderSchema, UpdateProfileSchema } from "shared";
import {
  requireAdmin,
  requireAuth,
  requireAuthAllowInactive,
} from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  placeholderList,
  placeholderMerge,
  userDeactivate,
  userDeactivateSelf,
  userList,
  userReactivateSelf,
  userUpdateSelf,
} from "./users.controller";

const router = express.Router();

// Sign-up lives at /api/auth/sign-up/email (Better Auth).
router.get("/", requireAuth, userList);

// /me and /placeholders routes come before /:id, or "me" would be read as an id.
router.patch("/me", requireAuth, validate(UpdateProfileSchema), userUpdateSelf);
router.post("/me/deactivate", requireAuth, userDeactivateSelf);
router.post("/me/reactivate", requireAuthAllowInactive, userReactivateSelf);
router.get("/placeholders", requireAuth, requireAdmin, placeholderList);
router.post(
  "/placeholders/:id/merge",
  requireAuth,
  requireAdmin,
  validate(MergePlaceholderSchema),
  placeholderMerge,
);
router.post("/:id/deactivate", requireAuth, requireAdmin, userDeactivate);

export default router;
