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

## Sprint 6 — Settings / staff management

The exact friction from the Sprint 1 setup — fixing a login's role or branch meant hand-writing SQL in the Supabase editor — is gone. Production users now get a full staff list on the Settings page with editable name, branch, and role per person, backed by two new RLS policies: `Production can read every profile` and `Production can update every profile` (previously everyone, including production, could only see and edit their own row).

Branch users see a read-only card of their own profile instead, with a note to ask production for changes — same "role decides what you see" pattern as My Jobs.

Not built: creating brand-new logins from inside the app. That still means Supabase Authentication → Users → Add user, same as it always has — a real invite flow needs a server-side call with the `service_role` key, and `docs/architecture.md` is explicit that key never belongs in the front end. Fixing an existing person's access is now self-service; onboarding a new one is still a one-time Supabase step.

One known limitation: if a production user changes their *own* role or branch, the sidebar won't reflect it until they sign out and back in — the signed-in session's profile isn't re-fetched automatically after a Settings edit.

## Sprint 7 — Notifications + QA

**Notifications.** A real invite/email system needs a server-side function with the `service_role` key — same reasoning as Sprint 6's staff-management decision, so it stayed out. Realtime was already wired up from Sprint 4, so in-app toast notifications get most of the value with no new infrastructure: branches get a toast when their job goes Ready or gets returned for correction; production gets a toast when a new job comes in. Each side only sees the notifications relevant to it — production doesn't get toasted for its own actions, and a branch doesn't get toasted about a job it just submitted itself.

**QA pass — three real issues found and fixed, not just reviewed:**

1. **Mobile nav was completely broken.** Since Sprint 1, the CSS had a `.menu-button { display:block }` rule at the ≤680px breakpoint, styled for a button that never existed in the HTML — meanwhile the sidebar got `display:none` at that same width. On a phone, the entire navigation vanished with no way to bring it back. Fixed with a real menu button, a slide-out sidebar, and a tap-outside-to-close backdrop.
2. **Profiles had no server-side guard against self-promotion.** The Sprint 1 "users can update their own profile" policy didn't restrict which columns could change — nothing stopped a branch_user from calling the Supabase API directly and setting their own `role` to `production`. The app's UI never offered this, but RLS is the actual security boundary, not the UI. A trigger now reverts `role`/`branch` changes on self-updates unless the caller is already production.
3. **Job creation didn't validate its own status.** The insert policy checked who was creating a job and for which branch, but never checked what status it started at — a crafted request could have inserted a job as already `ready` or `collected`. The policy now requires `status = 'incoming'` and `accepted_by is null` on every insert.

Also: escaped the one place a user-derived value (the sign-in initial in the top bar) was interpolated without `escapeHtml`, for defense in depth even though email format makes it low risk in practice. And updated `docs/database.md`, which still described the old "hand-edit branch in SQL" setup flow from before Settings existed.

All four migrations (`202608020001` through `202608020004`) must run in order for a fresh database; on an existing one, only `202608020004_qa_rls_hardening.sql` is new for this sprint.

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
