# Live Blackboard Class

A real-time classroom. One teacher controls what every anonymous student sees: a
welcome screen, a live Markdown lesson (with KaTeX math and highlighted Python), or a poll.

Live: https://class.pknspace.com

## Features

- **Students** open `/`. They don't log in and there's no navigation. They follow the
  teacher's screen live.
- **The teacher** opens `/teacher`, signs in with email and password (allowlisted), and
  runs the Command Center.

## Stack

React 19, Vite, TypeScript (strict), Tailwind v4, shadcn/ui, Convex (reactive
queries only), `@convex-dev/auth` (Password provider), react-markdown, KaTeX,
highlight.js, and `@uiw/react-md-editor`.

## Development

Development uses a **Convex local deployment**: the open-source backend binary runs on
your machine with SQLite. You don't need a Convex account. Requires Node 20+.

```bash
npm install
npx convex dev            # choose "start without an account" (local). Keep it running.
npm run setup:auth && npx convex env set SITE_URL http://localhost:5173 && npx convex env set TEACHER_EMAILS you@school.edu && npm run seed
npm run dev               # second terminal → http://localhost:5173
```

For non-interactive runs (CI or agents), use `CONVEX_AGENT_MODE=anonymous npx convex dev`
to skip the prompt. `npx convex dev` writes `.env.local` (`CONVEX_DEPLOYMENT`,
`VITE_CONVEX_URL=http://127.0.0.1:3210`, `VITE_CONVEX_SITE_URL`). See `.env.example`.

Once `npm install` has run, everything works offline.

### Creating the teacher account

1. Make sure your email is in the allowlist: `npx convex env set TEACHER_EMAILS you@school.edu`
   (comma-separate multiple teachers).
2. Open http://localhost:5173/teacher and choose **"First time? Create the teacher
   account"**. Enter that email and a password of at least 8 characters.

Sign-up is rejected for any email that isn't in `TEACHER_EMAILS`. If you remove an email
from the list later, that user sees **Access denied**, and every teacher function throws
for them.

### Seeding

```bash
npm run seed              # = npx convex run seed:default
```

This is idempotent. It creates lessons 1–40 (1–5 have full content; 6–40 are locked
placeholders) and the singleton classroom document. It skips lessons that already exist.

### Resetting local data

```bash
npx convex run seed:reset && npm run seed   # wipe lessons/polls/votes/room, keep accounts
```

To wipe **everything**, including teacher accounts:

1. Stop `npx convex dev`.
2. Delete `.convex/local/` in this project.
3. Run `npx convex dev` again.
4. Repeat the env and seed commands above.

### Lesson numbering

Lesson numbers are text and can nest to any depth: `1`, `1.1`, `1.2.3`. The drawer shows
sub-lessons indented under their parent and sorts each segment as a number, so
`1.2 < 1.10`.

- **Add:** **+ New Lesson** adds the next top-level lesson. The list-plus icon on a row adds
  a sub-lesson under it.
- **Renumber:** edit the number in the editor header. Sub-lessons move with their parent
  (`1` → `3` turns `1.2` into `3.2`). The parent must already exist, and numbers must be
  unique.
- **Delete:** a lesson that has sub-lessons can't be deleted until they are deleted or
  moved.

Upgrading a database from before nesting existed (numeric `lessonNumber`) needs a one-off
migration: `npx convex run migrations:lessonNumbersToString`. Run it while the schema still
accepts both types.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (http://localhost:5173) |
| `npx convex dev` | Local Convex backend and function hot-reload |
| `npm run build` | Typecheck and production build |
| `npm run typecheck` | App and `convex/` typecheck |
| `npm run seed` | Idempotent seed |
| `npm run setup:auth` | Generate and set `JWT_PRIVATE_KEY` + `JWKS` |
| `npm run lint` | oxlint |
| `npm run check` | Typecheck and lint |
| `npm run deploy` | Deploys the backend, builds and uploads the site |
| `npm run deploy:dry` | Same checks, but only previews the deploy and upload |

## Deployment

Production runs on a Convex cloud deployment (backend) plus a VPS where Caddy serves the
static `dist/` (no restart needed). `npm run deploy` does both.

One-time setup:

1. Create a Convex cloud project and generate a **production deploy key** in the dashboard.
2. Copy the production section of `.env.example` into `.env.prod.local` (git-ignored) and
   fill in `CONVEX_DEPLOY_KEY`, `DEPLOY_HOST`, `DEPLOY_PORT` and `DEPLOY_DIR`. You also need
   SSH key access to the server.
3. Set the Convex-side env vars on the **production** deployment:
   ```bash
   node scripts/setup-auth-keys.ts --apply --prod
   npx convex env set --prod SITE_URL https://class.pknspace.com
   npx convex env set --prod TEACHER_EMAILS you@school.edu
   ```
4. Seed production once: `npx convex run --prod seed:default`. Then create the teacher
   account at `/teacher`.

Deploy:

```bash
npm run deploy:dry   # checks, then preview the backend push and the upload
npm run deploy       # checks, deploy convex/, build with the production URL, upload
```

## How it works

- **One subscription.** Students and the teacher's Live Student Monitor both render
  `<StudentStage>`, which subscribes to `classroom:getActiveSession`. The monitor never
  reads editor state.
- **No answer leaks.** `getActiveSession` includes `correctIndex` and vote counts only after
  `showResults` is true.
- **Voting.** Each browser gets a `nanoid` token stored in `localStorage`, so new tabs share
  it. The server enforces one vote per `(pollId, voterToken)` and rejects votes once results
  are revealed.
- **Security.** Every teacher query and mutation calls `requireTeacher(ctx)`. It checks that
  the caller is signed in and that their email is in `TEACHER_EMAILS`. User-facing errors
  are thrown as `ConvexError`, so their messages also reach the client in production.
- **Rendering safety.** Raw HTML is skipped. KaTeX runs with `throwOnError: false`, and an
  ErrorBoundary falls back to the raw Markdown, resetting when the content changes.
