# Live Blackboard Class

A real-time classroom. One teacher controls what every anonymous student sees: a
welcome screen, a live Markdown lesson (with KaTeX math and highlighted Python), or a poll.

Live: https://class.pknspace.com

## Features

- **Students** open `/`. They don't log in and there's no navigation. They follow the
  teacher's screen live.
- **The teacher** opens `/teacher`, signs in with email and password (allowlisted), and
  runs the Command Center.
- **Polls** written ahead: inline in a lesson (they start when their slide is shown), in a
  lesson's Polls tab, or in a reusable poll bank. Quiz or opinion polls with 2–6 options.
  Votes are never kept: each class starts from zero.
- **Presenter notes** only the teacher sees: `%% note` for one line, or lines between two
  `%%` lines for a longer note.
- **Links stay in the class page.** A link a student clicks opens in a panel over the board,
  never a new tab, and the student can close it. **Show** (Classroom tab) opens a link on every
  screen that only the teacher can close. **Back to board**, the next slide, a push or a poll
  closes every panel. Sites that refuse to be shown inside another page (Google, Gemini,
  GitHub, Quick Draw…) open in a new tab instead, and the Links card marks them ⚠ New tab;
  YouTube links play in the embed player. The backend checks each link's
  `X-Frame-Options` / `frame-ancestors` headers when a lesson is saved, pushed or edited live
  (`backend/convex/links.ts`; live edits wait 10 s so half-typed links are skipped). Results stay in
  `linkChecks` for good; ↻ next to ⚠ New tab checks a link again.

## Stack

React 19, Vite, TypeScript (strict), Tailwind v4, shadcn/ui, Convex (reactive
queries only), `@convex-dev/auth` (Password provider), react-markdown, KaTeX,
highlight.js, and `@uiw/react-md-editor`.

## Development

Development uses a **Convex local deployment**: the open-source backend binary runs on
your machine with SQLite. You don't need a Convex account. Requires Node 22.18+ (`.nvmrc` pins 22).

```bash
cd backend && npm install
npx convex dev            # choose "start without an account" (local). Keep it running.
npm run setup:auth && npx convex env set SITE_URL http://localhost:5173 && npx convex env set ALLOWED_EMAILS you@school.edu && npm run seed
cd ../web && npm install && npm run dev   # second terminal → http://localhost:5173
```

For non-interactive runs (CI or agents), use `CONVEX_AGENT_MODE=anonymous npx convex dev`
to skip the prompt. `npx convex dev` writes `backend/.env.local` (`CONVEX_DEPLOYMENT`,
`VITE_CONVEX_URL=http://127.0.0.1:3210`, `VITE_CONVEX_SITE_URL`). See `backend/.env.example`.

Once `npm install` has run, everything works offline.

### Creating the teacher account

1. Make sure your email is in the allowlist: `npx convex env set ALLOWED_EMAILS you@school.edu`
   (comma-separate multiple teachers).
2. Open http://localhost:5173/teacher and choose **"First time? Create the teacher
   account"**. Enter that email and a password of at least 8 characters.

Sign-up is rejected for any email that isn't in `ALLOWED_EMAILS`. If you remove an email
from the list later, that user sees **Access denied**, and every teacher function throws
for them.

### Seeding

Run these, and the other `npx convex` commands, in `backend/`.

```bash
npm run seed              # = npx convex run seed:default
```

This is idempotent. It creates lessons 1–40 (1–5 have full content; 6–40 are locked
placeholders) and the singleton classroom document. It skips lessons that already exist.

### Resetting local data

```bash
npx convex run seed:reset && npm run seed   # wipe lessons, polls, votes and the room; keep accounts
```

To wipe **everything**, including teacher accounts:

1. Stop `npx convex dev`.
2. Delete `backend/.convex/local/`.
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

### Polls

A poll has a question (Markdown, so math and code work) and 2–6 plain-text options. Mark a
correct answer for a quiz; leave it unmarked for an opinion poll, which shows only the bars.
Results are always revealed by hand, and students can't change their vote.

**Inline polls** live in the lesson's Markdown (the toolbar's poll button inserts one):

````markdown
Quick check:

```poll
What is $F$ if $m = 2$ and $a = 3$?
- 5
- [x] 6
- 9
```
````

- It starts when its slide is shown and appears under the slide's text (in build-up mode,
  under the earlier slides too).
- Moving to another slide closes voting and reveals the results; in build-up mode they stay
  on the board. Going back shows them again; **Run again** (Polls tab) clears the votes
  and reopens voting.
- The Polls tab shows the current slide's poll with live counts and **Reveal**.
- Editing a poll on the live board starts it again.

**Saved polls** live in the Polls tab:

- **Lesson polls** belong to one lesson and are deleted with it.
- **Bank polls** are reusable. Add one to any number of lessons; it's shared, not copied, so
  an edit changes it everywhere. Deleting a lesson only removes the link.
- **Launch** shows a saved poll full screen. **Close** ends it, deletes its votes and returns
  to the lesson. A poll can't be edited while it's on screen.

**Nothing is kept between classes.** Push to Room and Blank Blackboard delete every poll's
votes, so teaching the same lesson to the next section is Blank Blackboard, then Push to Room.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` (`web/`) | Vite dev server (http://localhost:5173) |
| `npm run build` (`web/`) | Typecheck and production build (`web/dist/`) |
| `npm run check` (`web/`) | Typecheck, lint and tests (incl. error-message tests) |
| `npm run dev` (`backend/`) | Local Convex backend and function hot-reload |
| `npm run seed` (`backend/`) | Idempotent seed |
| `npm run setup:auth` (`backend/`) | Generate and set `JWT_PRIVATE_KEY` + `JWKS` |
| `npm test` (`backend/`) | Backend tests (Vitest, convex-test): lesson numbers, slides, notes, polls |
| `npm run check` (`backend/`) | Typecheck, lint and tests |
| `scripts/check.sh` | Every part's `check`; run before committing |
| `scripts/deploy.sh` | Deploys the backend, builds and uploads the site |
| `DRY_RUN=1 scripts/deploy.sh` | Same checks, but only previews the deploy and upload |

## Deployment

Production runs on a Convex cloud deployment (backend) plus a VPS where Caddy serves the
static `web/dist/` (no restart needed). `scripts/deploy.sh` does both.

One-time setup:

1. Create a Convex cloud project and generate a **production deploy key** in the dashboard.
2. Create the two git-ignored files from the `.env.example` next to each: `CONVEX_DEPLOY_KEY` in `backend/.env.prod.local`, and `DEPLOY_HOST`, `DEPLOY_PORT`
   and `DEPLOY_DIR` in `web/.env.prod.local`. You also need
   SSH key access to the server.
3. Set the Convex-side env vars on the **production** deployment (in `backend/`):
   ```bash
   node scripts/setup-auth-keys.ts --apply --prod
   npx convex env set --prod SITE_URL https://class.pknspace.com
   npx convex env set --prod ALLOWED_EMAILS you@school.edu
   ```
4. Seed production once: `npx convex run --prod seed:default`. Then create the teacher
   account at `/teacher`.

Deploy:

```bash
DRY_RUN=1 scripts/deploy.sh   # checks, then preview the backend push and the upload
scripts/deploy.sh             # checks, deploy backend/convex/, build with the production URL, upload
```

## How it works

- **One subscription.** Students and the teacher's Live Student Monitor both render
  `<StudentStage>`, which subscribes to `classroom:getActiveSession`. The monitor never
  reads editor state.
- **Polls and runs.** `polls` holds saved polls (`ownerLessonId` set for lesson polls, unset
  for the bank) and `lessonPolls` each lesson's ordered list. Inline polls are parsed from the
  Markdown (`backend/convex/lib/inlinePolls.ts`), with the same rules (`lib/pollRules.ts`).
  Showing a poll creates a `pollRuns` row (a copy of the poll plus open/revealed); votes
  belong to a run, and runs are deleted on close, Push to Room and Blank Blackboard.
  `lib/inlineRuns.ts` starts, reveals and restarts inline runs as slides change.
- **No answer leaks.** `getActiveSession` includes a poll's `correctIndex` and vote counts
  only after it's revealed.
- **Voting.** Each browser gets a `nanoid` token stored in `localStorage`, so new tabs share
  it. The server enforces one vote per `(runId, voterToken)` and rejects votes once results
  are revealed.
- **Security.** Every teacher query and mutation calls `requireTeacher(ctx)`. It checks that
  the caller is signed in and that their email is in `ALLOWED_EMAILS`. User-facing errors
  are thrown as `ConvexError`, so their messages also reach the client in production.
- **UI.** shadcn/ui components live in `web/src/components/ui/` (vendored, added with `npx shadcn add`, not linted).
- **Tests.** The pure helpers in `backend/convex/lib/` (lesson numbers, slides, presenter notes, poll parsing, links) have Vitest tests next to them, and `backend/convex/polls.test.ts` and `links.test.ts` run the poll and link functions with `convex-test`. Convex skips `*.test.ts` files when deploying.
- **Rendering safety.** Raw HTML is skipped. KaTeX runs with `throwOnError: false`, and an
  ErrorBoundary falls back to the raw Markdown, resetting when the content changes.
