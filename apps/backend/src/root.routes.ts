import express from "express";
import bookRoutes from "./books/books.routes";
import inviteRoutes from "./invites/invites.routes";
import meetingRoutes from "./meetings/meetings.routes";
import userRoutes from "./users/users.routes";
import venueRoutes from "./venues/venues.routes";

const router = express.Router();

router.use("/books", bookRoutes);
router.use("/invites", inviteRoutes);
router.use("/meetings", meetingRoutes);
router.use("/users", userRoutes);
router.use("/venues", venueRoutes);

export default router;
