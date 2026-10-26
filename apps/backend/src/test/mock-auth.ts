import { type Request, type RequestHandler } from "express";
import { ForbiddenError, UnauthorizedError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { type AuthUser } from "../middleware/auth";

// Stands in for middleware/auth in database specs:
//   vi.mock("../middleware/auth", () => import("../test/mock-auth"));
// The signed-in user is whoever's id is in the x-test-user header, loaded
// from the test database, so isAdmin and status are real. Same exports and
// errors as the real module.
export const TEST_USER_HEADER = "x-test-user";

const signedInUser = async (req: Request): Promise<AuthUser> => {
  const id = req.header(TEST_USER_HEADER);
  const user = id ? await prisma.user.findUnique({ where: { id } }) : null;
  if (!user) {
    throw new UnauthorizedError("Sign in to continue");
  }
  return user as AuthUser;
};

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const user = await signedInUser(req);
  if (user.status === "INACTIVE") {
    throw new ForbiddenError("This account is inactive", "ACCOUNT_INACTIVE");
  }
  req.user = user;
  next();
};

export const requireAuthAllowInactive: RequestHandler = async (
  req,
  _res,
  next,
) => {
  req.user = await signedInUser(req);
  next();
};

export const getUser = (req: Request): AuthUser => {
  if (!req.user) {
    throw new UnauthorizedError("Sign in to continue");
  }
  return req.user;
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    throw new UnauthorizedError("Sign in to continue");
  }
  if (!req.user.isAdmin) {
    throw new ForbiddenError("Admins only");
  }
  next();
};
