import express from "express";
import bookRoutes from "./books/books.routes";
import healthRoutes from "./health/health.routes";
import inviteRoutes from "./invites/invites.routes";
import meetingRoutes from "./meetings/meetings.routes";
import pollRoutes from "./polls/polls.routes";
import userRoutes from "./users/users.routes";
import venueRoutes from "./venues/venues.routes";

const router = express.Router();

router.use("/books", bookRoutes);
router.use("/health", healthRoutes);
router.use("/invites", inviteRoutes);
router.use("/meetings", meetingRoutes);
router.use("/polls", pollRoutes);
router.use("/users", userRoutes);
router.use("/venues", venueRoutes);

export default router;
