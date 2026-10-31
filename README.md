# Read Between the Wines

[![CI](https://github.com/JNC260/read-between-the-wines/actions/workflows/ci.yml/badge.svg)](https://github.com/JNC260/read-between-the-wines/actions/workflows/ci.yml)

An invite-only website for a real book club in Paducah, Kentucky. It replaces a mix of Facebook events, WhatsApp group chats and Google Forms with one place where members suggest books, vote on the next read, RSVP to meetings and get reminders. Members don't need Facebook, WhatsApp or a Google account to take part.

**Live (invite-only):** [readbetweenthewinespaducah.org](https://readbetweenthewinespaducah.org)

**Stack:** TypeScript · React 19 · React Query · Express 5 · Prisma 7 · PostgreSQL 17 · Zod · Better Auth · Vitest · Nx · Docker · Railway

<!-- TODO: add screenshots to docs/screenshots/ -->
| Meetings | Voting on the next book | Suggestions |
| --- | --- | --- |
| ![Meeting page with RSVP card](docs/screenshots/meeting.png) | ![Poll ballot](docs/screenshots/poll.png) | ![Suggestions with filters](docs/screenshots/suggestions.png) |

---

## The problem

The club used to be spread across several tools:

- **Facebook events** for meetings. Members who weren't on Facebook missed them.
- **WhatsApp chats** for reminders and logistics. Details got lost in the scroll.
- **Google Forms** for book suggestions and votes. Results lived in a spreadsheet only one person could see.

Members had to check three apps and an organizer had to keep them in sync. This site keeps all of that in one place and sends email to everyone. Admins still get one-tap "share to WhatsApp" links for the people who want them.

## What it does

**Members**
- Join through a single-use invite link from another member, then verify their email
- Suggest books by pasting a Goodreads link or searching Open Library. Details and covers fill in automatically, and duplicates are caught.
- Browse suggestions and past reads, filtered by genre. Genres are tagged by Claude from a fixed club list.
- Vote in polls for the next book, with a set number of votes per member
- RSVP to meetings with guest counts and the dish they're bringing, and add meetings to their calendar
- Get email when a poll opens and reminders before votes close and meetings start, with a per-type opt-out
- Keep a profile with a photo and social links

**Admins**
- Create, edit, close and reopen polls, and assign the winning book to a meeting
- Schedule, cancel and restore meetings, with venue, food, craft and directions
- Manage members: invite, deactivate, ban, merge duplicate accounts, promote or remove admins

Meeting and poll links shared in group chats show a rich preview card (book cover, date) without exposing private details.

## Architecture

```
apps/
  frontend/   React + Vite SPA, React Router, React Query
  backend/    Express 5 API, Prisma, background reminders
libs/
  shared/     Zod schemas and the TypeScript types inferred from them
```

### Backend layering

Each feature is its own folder (`books/`, `polls/`, `meetings/`, `invites/`, `notifications/`, …) with the same three files:

```
polls.routes.ts      → URL, auth and validation middleware
polls.controller.ts  → reads req, calls the service, writes res. No logic.
polls.service.ts     → business rules. The only layer that touches Prisma.
```

A request flows through these steps:

```
route → requireAuth / requireAdmin → validate(ZodSchema) → controller → service → Prisma
                                                                          │
                                       throws NotFoundError, ConflictError, …
                                                                          ▼
                                                       errorHandler → { error: { code, message, details? } }
```

### Key decisions and trade-offs

**One schema, shared by both apps.** Request and response shapes are Zod schemas in `libs/shared`. The backend uses them to validate bodies in middleware before any controller runs. The frontend validates every form with the same schemas, showing each message next to its field, and uses the inferred types for its API client. The sign-up and password forms share their length limits with the Better Auth config on the server. A change to a field breaks the build on both sides instead of failing at runtime.

**Typed errors and one error handler.** Services throw `AppError` subclasses (`BadRequestError`, `ForbiddenError`, `ConflictError`, `BadGatewayError`, …), each with an HTTP status and a stable code like `ACCOUNT_INACTIVE` or `INVITE_INVALID`. A single middleware turns them into a consistent JSON shape, and the frontend branches on `code`, not on message text. A failed Zod parse of a request is a 400. A Zod error anywhere else is treated as a server bug and returns a 500.

**Configuration is validated at startup.** Every environment variable goes through a Zod schema when the process starts, including production-only rules such as HTTPS being required and an email API key being present. A missing secret stops the deploy with a clear message listing variable names only, never values. Without this, the failure would show up on the first request that needs the variable.

**Exactly-once reminder emails without a job queue.** Reminders run on an in-process 15-minute interval, so there's only one service to deploy. To make this safe across restarts and overlapping runs, each send first *claims* a `NotificationLog` row protected by a unique constraint on `(user, kind, subject)`. If the insert hits the constraint, someone else already sent it. If the email fails, the claim is released so the next run retries. *Trade-off:* this is fine for one instance and a club-sized member list. At larger scale it should move to a real queue or scheduled job.

**Invite-only signup enforced at the auth layer.** Invite tokens are random. Only their SHA-256 hash is stored, so a database leak doesn't expose working links. The check runs in a Better Auth `user.create` hook, so every path that creates a user goes through it, including the admin CLI script. Banned users are blocked in a `session.create` hook as well as in the API middleware, so they can't use the auth library's own endpoints either.

**Same-origin deploy.** In production the Express server also serves the built React app. Auth cookies stay first-party, CORS isn't needed, and the whole site is a single Docker image. Hashed assets are cached indefinitely. A request for an asset from a previous deploy gets a real 404 instead of falling back to `index.html`, which would otherwise load as a blank page.

**Defensive handling of outside data and uploads.**
- Open Library responses are parsed with Zod, and a malformed or failed response becomes a 502, not a crash.
- Covers are cached locally because Open Library's redirects were timing out on phones. Only covers of books in the database can be cached, so the endpoint can't be used to fill the disk.
- Profile photos are decoded and re-encoded with `sharp` into a 512px WebP. This proves the file really is an image, strips EXIF data including GPS location, and caps the decoded pixel count to block decompression bombs.

**AI as an optional feature.** Genre tagging calls Claude with structured output limited to the club's fixed genre list. Without an API key the site works normally and new books simply aren't tagged.

**Data model.** The model covers users, books, suggestions, ratings, polls, votes, meetings, RSVPs and venues in Postgres, using composite primary keys on the join tables. Duplicate books are prevented by Open Library work ID, with a normalized-title check for books entered by hand.

## Testing

Tests use Vitest in both apps and fall into three groups:

- **Unit tests** for pure logic: parsing, config, image processing, Open Library mapping.
- **Database tests** (`*.db.spec.ts`) run services and HTTP routes against a real Postgres test database. Migrations are applied before the suite runs, so tests exercise real constraints and transactions instead of a mocked Prisma.
- **Frontend tests** use Testing Library on pages and components.

`npm run test:backend` decides which suites to run based on the paths you pass it, and only starts the test database when database specs are included.

GitHub Actions runs lint, typecheck, unit tests, database tests and the production build on every pull request. The database tests use the same docker-compose Postgres as local development.

## Deployment

The site runs on Railway, defined as code in `.railway/railway.ts`:

- A multi-stage Dockerfile builds both apps and ships a runtime image with production dependencies only. The server runs as an unprivileged user.
- `prisma migrate deploy` runs before the new version takes traffic. If a migration fails, the deploy stops and the old version keeps running.
- `/api/health` checks the database connection, and Railway uses it as the health check.
- Uploads are stored on a Railway volume. *Trade-off:* this rules out multiple replicas and causes a few seconds of downtime per deploy. The storage module is isolated so it could be switched to object storage later.

Club data was migrated from the old Google Forms CSVs with a two-step script. The first step matches each book against Open Library and writes a report for a person to review. The second step loads the reviewed data into the database.

## Running locally

Requirements: Node 24 and Docker.

```bash
cp .env.example .env              # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
npm install
npx nx run backend:db             # Postgres + Mailpit (catches outgoing email at localhost:8025)
npx prisma migrate deploy --config apps/backend/prisma.config.ts
npx nx run backend:create-admin --email=you@example.com --first-name=Ada --last-name=Lovelace
npm run dev                       # frontend on :4200, API on :3333
```

```bash
npm run test:backend
npm run test:frontend
```

## Built with Claude Code

I built this project together with [Claude Code](https://claude.com/claude-code), Anthropic's AI coding agent. I used it as a learning project: I set the architecture and conventions in a `CLAUDE.md` file and wrote key parts myself. I used Claude Code to implement and review features, discuss design trade-offs, and keep the codebase consistent with those conventions.

## License

MIT
