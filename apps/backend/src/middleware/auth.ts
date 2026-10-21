import { type Request, type RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { ForbiddenError, UnauthorizedError } from "../lib/errors";

export type AuthUser = typeof auth.$Infer.Session.user;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      // Set by requireAuth. Routes behind it can rely on it being there.
      user?: AuthUser;
    }
  }
}

// Reads the session cookie through Better Auth, which checks it against the
// Session table, so status and isAdmin are current on every request.
const getSignedInUser = async (req: Request): Promise<AuthUser> => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) {
    throw new UnauthorizedError("Sign in to continue");
  }
  if (session.user.status === "BANNED") {
    throw new ForbiddenError("This account has been banned", "ACCOUNT_BANNED");
  }
  return session.user;
};

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const user = await getSignedInUser(req);
  // The frontend uses this code to offer reactivation instead of an error.
  if (user.status === "INACTIVE") {
    throw new ForbiddenError("This account is inactive", "ACCOUNT_INACTIVE");
  }
  req.user = user;
  next();
};

// Like requireAuth, but lets inactive members through. Only for the routes
// they need to come back, like reactivating.
export const requireAuthAllowInactive: RequestHandler = async (
  req,
  _res,
  next,
) => {
  req.user = await getSignedInUser(req);
  next();
};

// For controllers behind requireAuth. Throws instead of returning undefined,
// so a route that forgot the middleware fails loudly with a 401.
export const getUser = (req: Request): AuthUser => {
  if (!req.user) {
    throw new UnauthorizedError("Sign in to continue");
  }
  return req.user;
};

// Use after requireAuth: router.post("/", requireAuth, requireAdmin, ...)
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    throw new UnauthorizedError("Sign in to continue");
  }
  if (!req.user.isAdmin) {
    throw new ForbiddenError("Admins only");
  }
  next();
};
