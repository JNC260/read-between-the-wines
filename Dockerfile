# One image for the whole site: Express serves the API under /api and the
# built React app for everything else. Railway builds it from this file and
# runs the pre-deploy migration in it (see .railway/railway.ts).
#
# Try it locally:
#   docker build -t rbtw .
#   docker run --rm -p 3000:3000 -e PORT=3000 --env-file .env rbtw
# Uploaded photos go in UPLOAD_DIR, a Railway volume in production.

FROM node:24-bookworm-slim AS base
# Prisma's schema engine, which `prisma migrate deploy` runs, needs OpenSSL.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Build with every dependency, since Nx, Vite and webpack are dev tools.
FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NX_DAEMON=false NX_NO_CLOUD=true NODE_ENV=production
RUN npx nx run-many -t build -p backend frontend

# Only what the running server and the migration step need.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist/apps ./dist/apps
# The pre-deploy `prisma migrate deploy` reads these.
COPY package.json ./
COPY apps/backend/prisma.config.ts apps/backend/
COPY apps/backend/prisma/schema.prisma apps/backend/prisma/
COPY apps/backend/prisma/migrations apps/backend/prisma/migrations
# Starts as root only long enough to give the uploads volume to the node
# user, then runs the server as node (see docker-start.sh).
COPY --chmod=755 docker-start.sh ./
CMD ["./docker-start.sh", "node", "dist/apps/backend/main.js"]
