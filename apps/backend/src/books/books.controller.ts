import { type Request, type Response } from "express";
import * as z from "zod";
import {
  BookCandidateSchema,
  BookDetailSchema,
  BookSchema,
  BookSearchQuerySchema,
  type CreateBookSuggestionDTO,
  type ManualBookSuggestionDTO,
  type RateBookDTO,
  RatingSchema,
  ReadBookSchema,
  SuggestedBookSchema,
  type UpdateBookDTO,
} from "shared";
import { BadRequestError } from "../lib/errors";
import { getUser } from "../middleware/auth";
import * as service from "./books.service";

// validate() only covers bodies, so the query string is parsed here.
export const searchBooks = async (req: Request, res: Response) => {
  const query = BookSearchQuerySchema.safeParse(req.query);
  if (!query.success) {
    throw new BadRequestError("Invalid query", z.flattenError(query.error));
  }
  const candidates = await service.searchBooks(query.data.q, getUser(req).id);
  res.json(z.encode(BookCandidateSchema.array(), candidates));
};

export const createSuggestion = async (
  req: Request<Record<string, string>, unknown, CreateBookSuggestionDTO>,
  res: Response,
) => {
  const book = await service.createSuggestion(getUser(req).id, req.body);
  res.status(201).json(z.encode(BookSchema, book));
};

export const createManualSuggestion = async (
  req: Request<Record<string, string>, unknown, ManualBookSuggestionDTO>,
  res: Response,
) => {
  const book = await service.createManualSuggestion(getUser(req).id, req.body);
  res.status(201).json(z.encode(BookSchema, book));
};

export const listSuggestions = async (req: Request, res: Response) => {
  const books = await service.listSuggestions(getUser(req).id);
  res.json(z.encode(SuggestedBookSchema.array(), books));
};

export const listReadBooks = async (req: Request, res: Response) => {
  const books = await service.listReadBooks(getUser(req).id);
  res.json(z.encode(ReadBookSchema.array(), books));
};

export const rateBook = async (
  req: Request<{ id: string }, unknown, RateBookDTO>,
  res: Response,
) => {
  const rating = await service.rateBook(
    getUser(req).id,
    req.params.id,
    req.body.score,
  );
  res.json(z.encode(RatingSchema, rating));
};

export const getBook = async (req: Request<{ id: string }>, res: Response) => {
  const book = await service.getBook(getUser(req), req.params.id);
  res.json(z.encode(BookDetailSchema, book));
};

export const updateBook = async (
  req: Request<{ id: string }, unknown, UpdateBookDTO>,
  res: Response,
) => {
  const book = await service.updateBook(getUser(req), req.params.id, req.body);
  res.json(z.encode(BookSchema, book));
};
