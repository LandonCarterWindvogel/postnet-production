# PostNet Production

PostNet Production is a progressive web app for managing sticker and T‑shirt flex work from intake through to collection. It deliberately records email artwork references instead of storing artwork files.

## Sprints

### Sprint 1 — Foundation

Vite PWA shell, responsive Production Board, login flow, secure Supabase schema, and job‑intake interface. Job persistence, live queue updates, stock, and notifications delivered in later sprints.

### Sprint 2 — Real jobs

Jobs are created and persisted in Supabase. Branches submit into Incoming, Production accepts into Queued, and each job moves through its type‑specific workflow (stickers or T‑shirt flex) to Ready and Collected.

### Sprint 3 — Architecture

`src/main.js` became a two‑line entry point; the app is split into `app/`, `stores/`, `components/`, and `utils/`. No behavior changed.

### Sprint 4 — Workflow fixes + Realtime

- **Return for correction** added: Production can send any active job back to the branch with a reason.
- **My Jobs** now filters correctly: branch users see their branch’s history; production sees jobs they personally accepted.
- **Realtime** updates the board and My Jobs live via Supabase Realtime.

### Sprint 5 — Stock

Materials table (`stock_items`) seeded with all options from the New Job form. Everyone can view; production can update. Low‑stock flag when quantity ≤ threshold. Realtime updates.

**Correction:** sticker materials are tracked by **weight (kg)**, not length. Flex materials remain in `sheets`.

### Sprint 6 — Settings / staff management

Production users can edit any profile’s name, branch, and role directly from the Settings page. Branch users see a read‑only card of their own profile. No invite flow – new logins still created in Supabase Auth → Users.

### Sprint 7 — Notifications + QA

In‑app toasts for relevant events (new job for production; ready/returned for branch). Fixed mobile nav, self‑promotion RLS loophole, job creation status validation, escaped user‑derived values, and updated documentation.

### Sprint 8 — Workflow enforcement & job events (current)

- **Database‑enforced workflow transitions** – status can only move forward according to the correct workflow for the job type.
- **Material compatibility** – sticker jobs can only use sticker materials; flex jobs only flex materials.
- **Branch resubmission** – branch users can resubmit a rejected job after correction (back to Incoming).
- **Job events & timeline** – every status change, creation, return, resubmission, and rush confirmation is recorded in `job_events` and displayed as a timeline on the job detail page.
- **24–48 hour standard** – normal jobs get an `expected_ready_by` of 48 hours from creation. Rush/urgent jobs require production confirmation before an expected date is set.
- **Rush/urgent confirmation** – production must explicitly confirm rush/urgent jobs; the UI shows a confirmation button.
- **Search and filters** on the Production Board (by job number, customer, branch, email, material; and filters for branch, priority, status, type, material).
- **Branch Dashboard** – branch users see counts and recent jobs.
- **Stock warnings** on the New Job form – warns if material is low or unavailable.
- **Production summary** – counts of overdue, urgent, returned, and ready jobs on the board.

### Sprint 9 — Architecture cleanup (optional future)

Event handlers split into modules for maintainability.

## Run locally

1. Copy `.env.example` to `.env`.
2. Enter your Supabase Project URL and anon/publishable key.
3. Run `npm install` and then `npm run dev`.
4. Apply the migrations in order (see below) in the Supabase SQL Editor before creating users. Then follow the database setup notes to create the first production user.

## Supabase Migrations (order)

Apply these in the Supabase SQL Editor in **exact** order:

1. `202607270001_initial_schema.sql`
2. `202607270002_production_job_submission.sql`
3. `202608020001_realtime_jobs.sql`
4. `202608020002_stock_tracking.sql`
5. `202608020003_staff_management.sql`
6. `202608020004_qa_rls_hardening.sql`
7. `202608020005_fix_profiles_recursion.sql`
8. `202608020006_stock_unit_kg.sql`
9. `202608020007_add_cutting_status.sql`
10. `202608020008_machine_status.sql`
11. `202608020009_workflow_enforcement.sql`
12. `202608020010_sla_fields.sql`
13. `202608020011_job_events.sql`

All migrations are idempotent where possible and preserve existing data.

## Deployment

Netlify is configured to build with `npm run build` and publish `dist`. Add the same two `VITE_SUPABASE_*` variables in the Netlify site settings.

## Product scope

- **Sticker materials**: Gloss Vinyl, Matte Vinyl, Clear Vinyl, Contravision (all in kg)
- **T‑shirt flex**: White Flex, Gold Flex, Silver Flex (all in sheets)
- **Branches**: Plettenberg Bay, Knysna, Waterside, Sedgefield
- **Artwork source**: email references to PDF and CDR files only; never uploads
- **Standard turnaround**: 24–48 hours for normal jobs. Rush/Urgent require production centre confirmation.
- **Workflows**:
  - Stickers: Incoming → Queued → Printing → Drying → Contour Cutting → Weeding → Quality Check → Ready → Collected
  - Flex: Incoming → Queued → Cutting → Weeding → Heat Press → Quality Check → Ready → Collected
- **Correction**: Active job → Rejected (with reason) → Branch corrects → Resubmitted → Incoming

## Security

- Row Level Security (RLS) is enforced on all tables.
- Only production users can promote or change roles/branches.
- Workflow transitions are enforced at the database level – the UI is not the security boundary.
- Material compatibility is checked on insert/update.
- The `service_role` key is never used in the frontend.