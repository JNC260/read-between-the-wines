import express from "express";
import { CreateUserSchema } from "shared";
import { validate } from "../middleware/validate";
import { userCreate, userList } from "./users.controller";

const router = express.Router();

router.get("/", userList);
router.post("/", validate(CreateUserSchema), userCreate);

export default router;
