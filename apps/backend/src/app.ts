import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type RequestHandler } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import { config, isProduction } from "./lib/config";
import { NotFoundError } from "./lib/errors";
import { UPLOADS_URL_PATH } from "./lib/storage";
import { errorHandler } from "./middleware/error-handler";
import rootRoutes from "./root.routes";

export const app = express();

// Railway's edge proxy terminates HTTPS and forwards the request. Trusting
// that one hop makes req.ip the member's address (for rate limits and
// session records) and req.protocol https.
app.set("trust proxy", 1);

// Better Auth reads the raw request body itself, so it has to be mounted
// before express.json(). *splat is Express 5's named wildcard.
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

// Members' photos, in development and production alike. Every upload gets a
// new random name, so a URL's contents never change and can be cached for
// good. Not behind sign-in: the names can't be guessed, and an <img> on the
// members page shouldn't cost a session lookup each. A missing file falls
// through to the JSON 404 below.
app.use(
  UPLOADS_URL_PATH,
  express.static(config.UPLOAD_DIR, {
    index: false,
    dotfiles: "deny",
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      // Trust our extension's type; never let a browser guess another.
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);

app.use("/api", rootRoutes);
// Unknown endpoints answer in the same JSON error shape as everything else,
// not Express's HTML page.
app.use("/api", (_req, _res, next) => next(new NotFoundError("No such endpoint")));

// In production this one service also serves the built React app, so the
// site and the API share an origin and auth cookies stay first-party. In
// development Vite serves the app and proxies /api here instead.
if (isProduction) {
  // The build puts the bundle in dist/apps/backend and the app in
  // dist/apps/frontend, side by side.
  const webRoot = fileURLToPath(new URL("../frontend/", import.meta.url));
  const indexHtml = path.join(webRoot, "index.html");

  app.use(
    express.static(webRoot, {
      index: false,
      // Vite puts a content hash in every file under assets/, so a changed
      // file gets a new name and the old one can be cached for good.
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );

  // Client-side routes like /books/read have no file of their own, so any
  // other GET gets index.html and React Router takes it from there.
  const spaFallback: RequestHandler = (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    // Always revalidate, so a deploy's new asset names are picked up.
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexHtml);
  };
  app.use(spaFallback);
}

app.use(errorHandler);
