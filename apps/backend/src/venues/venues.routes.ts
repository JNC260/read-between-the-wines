import express from "express";
import { CreateVenueSchema, UpdateVenueSchema } from "shared";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createVenue,
  getVenue,
  getVenueList,
  updateVenue,
} from "./venues.controller";

const router = express.Router();

router.use(requireAuth);

// Open to all members; mostly feeds the admin's meeting form.
router.get("/", getVenueList);
router.get("/:id", getVenue);
router.post("/", requireAdmin, validate(CreateVenueSchema), createVenue);
router.patch("/:id", requireAdmin, validate(UpdateVenueSchema), updateVenue);

export default router;
