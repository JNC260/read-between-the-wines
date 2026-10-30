import express from "express";
import { getCover } from "./covers.controller";

const router = express.Router();

// Public, like members' photos: an <img> shouldn't cost a session lookup,
// and the service only serves our books' covers.
router.get("/:file", getCover);

export default router;
