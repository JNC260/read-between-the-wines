// The live site on Railway, as code: one web service built from the
// Dockerfile, plus Railway Postgres. Preview changes with
//   railway config plan
// and apply them with `railway config apply`.
//
// Secrets are set in the Railway dashboard and kept with preserve(), so
// they're never written here.
import { defineRailway, github, postgres, preserve, project, service } from "railway/iac";

const SITE = "readbetweenthewinespaducah.org";

export default defineRailway(() => {
  const db = postgres("postgres");

  const web = service("web", {
    source: github("JNC260/read-between-the-wines", { branch: "main" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    start: "node dist/apps/backend/main.js",
    // Runs in the new image before it takes traffic; a failed migration
    // stops the deploy and leaves the old version running.
    preDeploy: "npx prisma migrate deploy --config apps/backend/prisma.config.ts",
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    domains: [SITE],
    env: {
      NODE_ENV: "production",
      DATABASE_URL: db.env.DATABASE_URL,
      BETTER_AUTH_URL: `https://${SITE}`,
      BETTER_AUTH_SECRET: preserve(),
      RESEND_API_KEY: preserve(),
      EMAIL_FROM: preserve(),
    },
  });

  return project("read-between-the-wines", { resources: [web, db] });
});
