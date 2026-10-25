import express from "express";
import { CreateBookSuggestionSchema } from "shared";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createSuggestion, searchBooks } from "./books.controller";

const router = express.Router();

router.use(requireAuth);

// ?q=<Goodreads link or title>. Searches Open Library and flags books the
// club has already suggested.
router.get("/search", searchBooks);
router.post(
  "/suggestions",
  validate(CreateBookSuggestionSchema),
  createSuggestion,
);

export default router;
