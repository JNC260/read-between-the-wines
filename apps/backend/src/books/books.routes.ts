import express from "express";
import { CreateBookSuggestionSchema } from "shared";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createSuggestion,
  listReadBooks,
  listSuggestions,
  searchBooks,
} from "./books.controller";

const router = express.Router();

router.use(requireAuth);

// ?q=<Goodreads link or title>. Searches Open Library and flags books the
// club has already suggested.
router.get("/search", searchBooks);
// Every member sees the full list, with who suggested what.
router.get("/suggestions", listSuggestions);
router.get("/read", listReadBooks);
router.post(
  "/suggestions",
  validate(CreateBookSuggestionSchema),
  createSuggestion,
);

export default router;
