import express from "express";
import inviteRoutes from "./invites/invites.routes";
import userRoutes from "./users/users.routes";

const router = express.Router();

router.use("/invites", inviteRoutes);
router.use("/users", userRoutes);

export default router;
