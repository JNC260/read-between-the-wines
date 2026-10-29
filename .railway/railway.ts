// The live site on Railway, as code: one web service built from the
// Dockerfile, plus Railway Postgres and a volume for uploaded photos.
// Preview changes with
//   railway config plan
// and apply them with `railway config apply`.
//
// Secrets are set in the Railway dashboard and kept with preserve(), so
// they're never written here.
import {
  defineRailway,
  github,
  postgres,
  preserve,
  project,
  service,
  volume,
} from "railway/iac";

const SITE = "readbetweenthewinespaducah.org";

// Where the uploads volume appears inside the container.
const UPLOADS = "/data/uploads";

export default defineRailway(() => {
  const db = postgres("postgres");
  // Members' photos. The container's own disk is wiped on every deploy; a
  // volume isn't. Trade-offs: a few seconds of downtime per deploy (the
  // old container has to let go of the volume first) and no replicas.
  const uploads = volume("uploads");

  const web = service("web", {
    source: github("JNC260/read-between-the-wines", { branch: "main" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    // docker-start.sh makes the volume writable, then runs the server as
    // the node user, not root.
    start: "./docker-start.sh node dist/apps/backend/main.js",
    // Runs in the new image before it takes traffic; a failed migration
    // stops the deploy and leaves the old version running.
    preDeploy: "npx prisma migrate deploy --config apps/backend/prisma.config.ts",
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    volumeMounts: { [UPLOADS]: uploads },
    // The custom domain (SITE) can't be registered from here: Railway only
    // accepts it in the dashboard, under web → Settings → Networking.
    env: {
      NODE_ENV: "production",
      DATABASE_URL: db.env.DATABASE_URL,
      BETTER_AUTH_URL: `https://${SITE}`,
      BETTER_AUTH_SECRET: preserve(),
      RESEND_API_KEY: preserve(),
      EMAIL_FROM: preserve(),
      UPLOAD_DIR: UPLOADS,
    },
  });

  return project("read-between-the-wines", { resources: [web, db, uploads] });
});
