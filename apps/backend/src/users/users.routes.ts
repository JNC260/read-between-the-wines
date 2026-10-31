import express from "express";
import {
  EmailSettingsSchema,
  MergeAccountSchema,
  MergePlaceholderSchema,
  UpdateProfileSchema,
} from "shared";
import {
  requireAdmin,
  requireAuth,
  requireAuthAllowInactive,
} from "../middleware/auth";
import { uploadImage } from "../middleware/upload";
import { validate } from "../middleware/validate";
import {
  accountList,
  emailSettingsGet,
  emailSettingsUpdate,
  placeholderList,
  placeholderMerge,
  userBan,
  userDeactivate,
  userDeactivateSelf,
  userMakeAdmin,
  userList,
  userMerge,
  userReactivateSelf,
  userRemoveAdmin,
  userRemoveImage,
  userUnban,
  userUpdateSelf,
  userUploadImage,
} from "./users.controller";

const router = express.Router();

// Sign-up lives at /api/auth/sign-up/email (Better Auth).
router.get("/", requireAuth, userList);

// /me and /placeholders routes come before /:id, or "me" would be read as an id.
router.patch("/me", requireAuth, validate(UpdateProfileSchema), userUpdateSelf);
// The image has its own endpoint: it's multipart, not JSON.
router.put("/me/image", requireAuth, uploadImage, userUploadImage);
router.delete("/me/image", requireAuth, userRemoveImage);
// Only this member's own, unlike the profile fields, which every member sees.
router.get("/me/notifications", requireAuth, emailSettingsGet);
router.put(
  "/me/notifications",
  requireAuth,
  validate(EmailSettingsSchema),
  emailSettingsUpdate,
);
router.post("/me/deactivate", requireAuth, userDeactivateSelf);
router.post("/me/reactivate", requireAuthAllowInactive, userReactivateSelf);
// Every account whatever its status, for the manage members page.
router.get("/accounts", requireAuth, requireAdmin, accountList);
router.get("/placeholders", requireAuth, requireAdmin, placeholderList);
router.post(
  "/placeholders/:id/merge",
  requireAuth,
  requireAdmin,
  validate(MergePlaceholderSchema),
  placeholderMerge,
);
router.post("/:id/deactivate", requireAuth, requireAdmin, userDeactivate);
router.post("/:id/ban", requireAuth, requireAdmin, userBan);
router.post("/:id/unban", requireAuth, requireAdmin, userUnban);
// For a member who signed up twice: :id is merged into keepId, then deleted.
router.post(
  "/:id/merge",
  requireAuth,
  requireAdmin,
  validate(MergeAccountSchema),
  userMerge,
);
// PUT and DELETE: it's a yes/no setting, and sending either twice is a 409.
router.put("/:id/admin", requireAuth, requireAdmin, userMakeAdmin);
router.delete("/:id/admin", requireAuth, requireAdmin, userRemoveAdmin);

export default router;
