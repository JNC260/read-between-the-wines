import express from "express";
import { unsubscribe } from "./notifications.controller";

const router = express.Router();

// Public: the link works without signing in, and is signed for one member.
router.post("/unsubscribe", unsubscribe);

export default router;
