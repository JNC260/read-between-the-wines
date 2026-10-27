import express from "express";
import { UpdateProfileSchema } from "shared";
import {
  requireAdmin,
  requireAuth,
  requireAuthAllowInactive,
} from "../middleware/auth";
import { uploadImage } from "../middleware/upload";
import { validate } from "../middleware/validate";
import {
  userDeactivate,
  userDeactivateSelf,
  userList,
  userReactivateSelf,
  userRemoveImage,
  userUpdateSelf,
  userUploadImage,
} from "./users.controller";

const router = express.Router();

// Sign-up lives at /api/auth/sign-up/email (Better Auth).
router.get("/", requireAuth, userList);

// /me routes come before /:id, or "me" would be read as an id.
router.patch("/me", requireAuth, validate(UpdateProfileSchema), userUpdateSelf);
// The image has its own endpoint: it's multipart, not JSON.
router.put("/me/image", requireAuth, uploadImage, userUploadImage);
router.delete("/me/image", requireAuth, userRemoveImage);
router.post("/me/deactivate", requireAuth, userDeactivateSelf);
router.post("/me/reactivate", requireAuthAllowInactive, userReactivateSelf);
router.post("/:id/deactivate", requireAuth, requireAdmin, userDeactivate);

export default router;
