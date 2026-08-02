# PostNet Production

PostNet Production is a progressive web app for managing sticker and T-shirt flex work from intake through to collection. It deliberately records email artwork references instead of storing artwork files.

## Sprint 1 — Foundation

This release provides the Vite PWA shell, responsive Production Board, login flow, a secure Supabase schema, and the job-intake interface. Job persistence, live queue updates, stock, and notifications are delivered in later sprints.

## Sprint 2 — Real jobs

Jobs are created and persisted in Supabase. Branches submit into Incoming, Production accepts into Queued, and each job moves through its type-specific workflow (stickers or T-shirt flex) to Ready and Collected.

## Sprint 3 — Architecture

`src/main.js` used to hold the entire app in one file. It's now a two-line entry point that calls `initApp()`. The app is split into:

- `src/app/` — `app.js` (wiring + event handling), `router.js` (page → view), `state.js` (current page/selection)
- `src/stores/` — `authStore.js` (session/profile) and `jobStore.js` (jobs), each a tiny pub-sub so the UI re-renders on change
- `src/components/` — one render function per view (`board/`, `jobs/`, `layout/`, `auth/`)
- `src/utils/` — `constants.js`, `formatters.js`, `dates.js`, `helpers.js`, `validators.js`

No behavior changed in this sprint — every screen, button, and workflow step works exactly as it did at the end of Sprint 2. This just makes the next sprint (Stock, Settings, and Sprint 4's Realtime) easier to build without one file growing indefinitely. The unused Sprint 1 sample-data file (`src/data/sample-jobs.js`) was also removed since real Supabase jobs replaced it in Sprint 2.

## Sprint 4 — Workflow fixes + Realtime

Two gaps from earlier sprints are closed:

- **Return for correction.** `docs/workflow.md` always described this, but there was no button for it. Production can now send any active job back to the branch with a reason (stored in the job's `notes` field). Rejected jobs leave the board, same as Collected ones, and show up in the branch's My Jobs history with the reason attached.
- **My Jobs actually filters now.** It used to show every job, identical to the board. Branch users now see their branch's full history (including Ready/Collected/Rejected, which the board hides); Production sees the jobs they personally accepted.

Also added: **Realtime**. The board and My Jobs update live via Supabase Realtime — if a branch submits a job, Production sees it appear without refreshing, and vice versa for status changes. The top bar's connection indicator now reflects the real Realtime connection state instead of a hardcoded "connected".

Run `supabase/migrations/202608020001_realtime_jobs.sql` after the Sprint 1 and 2 migrations — it just adds `public.jobs` to the `supabase_realtime` publication. No RLS changes were needed for the reject workflow; the existing "Production can manage every job" policy already covers it.

## Sprint 5 — Stock

[#sprint-5--stock](#sprint-5--stock)

Materials get their own table (`stock_items`) instead of being a "Coming later" placeholder. Everyone signed in can see current levels; production can update them. Every material already offered on the New Job form (`src/utils/constants.js` `MATERIALS`) is seeded as a row, grouped by Stickers / T-shirt Flex. A row is flagged "Low stock" once its quantity drops to or below its own threshold, and updates live via Realtime.

There's no automatic deduction when a job is created — jobs don't record a per-unit consumption rate, and a guessed one would be worse than an honest manual count. Levels start at 0/0 after the migration; set real quantities and thresholds from the Stock page before relying on the low-stock flag.

## Run locally

1. Copy `.env.example` to `.env`.
2. Enter your Supabase Project URL and anon/publishable key.
3. Run `npm install` and then `npm run dev`.
4. Apply `supabase/migrations/202607270001_initial_schema.sql` in the Supabase SQL Editor before creating users. Then follow [the database setup notes](docs/database.md) to create the first production user.

## Deployment

Netlify is configured to build with `npm run build` and publish `dist`. Add the same two `VITE_SUPABASE_*` variables in the Netlify site settings.

## Product scope

- Sticker materials: Gloss Vinyl, Matte Vinyl, Clear Vinyl, Contravision
- T-shirt flex: White Flex, Gold Flex, Silver Flex
- Branches: Plettenberg Bay, Knysna, Waterside, Sedgefield
- Artwork source: email references to PDF and CDR files only; never uploads
