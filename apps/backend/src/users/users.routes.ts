import express from "express";
import { userCreate, userList } from "./users.controller";

const router = express.Router();

router.get("/", userList);
router.post("/", userCreate);

export default router;
