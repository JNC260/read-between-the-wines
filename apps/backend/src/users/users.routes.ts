import express from "express";
import { MergePlaceholderSchema, UpdateProfileSchema } from "shared";
import {
  requireAdmin,
  requireAuth,
  requireAuthAllowInactive,
} from "../middleware/auth";
import { uploadImage } from "../middleware/upload";
import { validate } from "../middleware/validate";
import {
  accountList,
  placeholderList,
  placeholderMerge,
  userBan,
  userDeactivate,
  userDeactivateSelf,
  userList,
  userReactivateSelf,
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

export default router;
