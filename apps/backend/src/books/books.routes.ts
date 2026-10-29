import express from "express";
import {
  CreateBookSuggestionSchema,
  RateBookSchema,
  UpdateBookSchema,
} from "shared";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createSuggestion,
  getBook,
  listReadBooks,
  listSuggestions,
  rateBook,
  searchBooks,
  updateBook,
} from "./books.controller";

const router = express.Router();

router.use(requireAuth);

// ?q=<Goodreads link or title>. Searches Open Library and flags books the
// club has already suggested.
router.get("/search", searchBooks);
// Every member sees the full list, with who suggested what.
router.get("/suggestions", listSuggestions);
router.get("/read", listReadBooks);
// PUT, not POST: it sets this member's one rating, however many times it's sent.
router.put("/:id/rating", validate(RateBookSchema), rateBook);
router.post(
  "/suggestions",
  validate(CreateBookSuggestionSchema),
  createSuggestion,
);
// After the fixed paths above, so "/suggestions" isn't read as an id.
// Suggesters and admins can edit; the service checks which.
router.get("/:id", getBook);
router.patch("/:id", validate(UpdateBookSchema), updateBook);

export default router;
