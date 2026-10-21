# Read Between the Wines

Invite-only book club site. This is a learning project: when a task says
"I'll write this," create the file with a typed function signature and a
TODO, and do not implement it.

## Layout (Nx monorepo)

- apps/frontend: React, Vite, React Router, React Query
- apps/backend: Express 5
- libs/shared: Zod schemas and the types inferred from them

## Backend conventions

- One folder per feature: src/<feature>/<feature>.routes.ts, .controller.ts, .service.ts
- Controllers handle req/res only. Services hold logic and are the only layer that uses Prisma.
- Request bodies are validated with Zod schemas from libs/shared, in middleware before the controller.
- Services throw typed errors; one error-handling middleware turns them into consistent JSON responses.

## Database

- Postgres 17 via docker-compose.yaml at the repo root; all env vars live in the root .env
- Prisma 7 in apps/backend: schema in prisma/schema.prisma, client generated to generated/prisma
  (import PrismaClient from there, never from @prisma/client), Postgres driver adapter,
  one shared client in src/lib/prisma.ts

## Working agreements

- Run tasks through Nx (npx nx serve backend, npx nx test backend)
- Explain why before adding a dependency
- End each task with a short summary of what changed and any decision I should review
