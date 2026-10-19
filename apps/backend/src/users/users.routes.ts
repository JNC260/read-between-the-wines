import express from "express";
import { userList } from "./users.controller";

const router = express.Router();

router.get("/", userList);

export default router;
