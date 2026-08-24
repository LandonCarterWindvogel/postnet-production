# PostNet Production

PostNet Production is a browser-based production management PWA for the PostNet Copy & Print workflow. It manages sticker and T-shirt Flex jobs from intake through production and collection, with live Supabase updates, stock visibility, job history, correction/resubmission workflow, and role-based branch access.

## 1. Current scope

Keep the product intentionally focused. It is a production workflow tool, not a CRM or ERP.

Supported job types:

- **Stickers** — Gloss Vinyl, Matte Vinyl, Clear Vinyl, Contravision
- **T-shirt Flex** — White Flex, Gold Flex, Silver Flex

Supported stores:

- Plettenberg Bay
- Knysna
- Waterside
- Sedgefield

The Production Centre can see and manage all branches. Branch users are restricted by database RLS to their own branch.

## 2. User-facing production workflow

The user-facing workflow is intentionally simple so stores and operators do not have to click every machine stage.

```text
Submitted / Incoming → In Production → Ready → Collected / Sent
```

### Production actions

- **Start Production** — accepts an incoming job and moves it into the first machine stage.
- **Mark Ready** — advances the job through the remaining internal production states and records the final `ready` event.
- **Mark Collected / Sent** — closes a ready job as `collected`.

The detailed internal states are still stored for auditing, timelines, machine context and future reporting.

### Internal sticker workflow

`Incoming → Queued → Printing → Drying → Cutting → Weeding → Quality Check → Ready → Collected`

Internal database status for the sticker Cutting stage is `contour_cutting`.

### Internal T-shirt Flex workflow

`Incoming → Queued → Cutting → Weeding → Heat Press → Quality Check → Ready → Collected`

Internal database status for Flex Cutting is `cutting`.

The Production Board intentionally presents the detailed machine states as one user-facing **In Production** phase and presents both internal cutting statuses as one machine context. Do not recreate the old multi-click dashboard unless the business requirement changes.

### Returned for correction

Any active job may be returned by Production for correction:

`Active → Rejected → Incoming → Queued → ...`

The owning branch is responsible for correcting the artwork and resubmitting the job to `Incoming`. Production then starts it again.

This is a separate correction loop, not a backwards production transition. The database trigger is the final authority for allowed status changes.

## 3. Production Board overview

The top summary is intentionally aligned with the simplified workflow:

- **All** — all active jobs, excluding collected and rejected jobs.
- **Incoming** — submitted jobs waiting for Production to start.
- **In Production** — queued jobs plus all internal machine/production states.
- **Ready** — jobs completed and waiting for collection/sent handover.

Secondary alerts show **Urgent** and **Returned for Correction** counts.

The detailed internal state remains available in the table as supporting context, but the primary status shown to users is `Incoming`, `In Production`, `Ready`, or `Returned for Correction`.

## 4. Priorities and queue ordering

Use these labels everywhere:

- **Standard**
- **Rush**
- **Urgent**

Production Board ordering is:

`Urgent → Rush → Standard`

Within the same priority, jobs remain FIFO by creation time.

## 5. New Job wizard rules

The New Job page has three steps:

1. **Job Information**
2. **Sizes & Materials**
3. **Review & Submit**

A user may not proceed from Step 2 unless:

- width is present and greater than 0
- height is present and greater than 0
- quantity is a whole number of at least 1

Step 3 requires the artwork checklist before the job is inserted.

The browser's native hidden-control validation must not be relied upon because hidden wizard panels can cause Chrome's `invalid form control ... is not focusable` error. Application-side validation is the source of the user-facing wizard errors, while Supabase constraints remain the server-side backstop.

## 6. Machine-time estimator

The estimator describes **machine production time only: Print + Cut**.

It deliberately excludes:

- design time
- drying
- weeding
- heat pressing
- quality control
- queue/waiting time
- collection/courier time

### Current observed anchors

Sticker jobs:

| Size | Quantity | Estimate |
|---|---:|---:|
| 50×50 mm | 100 | ~35–40 min |
| 50×50 mm | 500 | ~3 h |
| 100×50 mm | 100 | ~45–55 min |
| 100×50 mm | 500 | ~4.5 h |
| 200×100 mm | 100 | ~2.5 h |

T-shirt Flex:

| Size | Quantity | Estimate |
|---|---:|---:|
| 100×100 mm | 10 | ~15–20 min |
| 200×200 mm | 10 | ~45–60 min |
| 200×200 mm | 25 | ~2 h |
| 300×300 mm | 25 | ~3.5–4 h |

The application uses the midpoint of the supplied ranges as model anchors and interpolates for other valid sizes/quantities. These estimates are not a promise of total customer completion time.

The estimator code lives in:

`src/utils/machineTime.js`

The client has also supplied a historical VersaWorks CSV export. It contains real BN-20 print logs, including print start/end timestamps, sizes and copies. It can be used later to validate and improve the model, but raw malformed CSV rows must be cleaned before using them for automated statistical fitting.

## 7. Stock

**All stock is measured in kilograms (kg).**

Materials:

- Gloss Vinyl — kg
- Matte Vinyl — kg
- Clear Vinyl — kg
- Contravision — kg
- White Flex — kg
- Gold Flex — kg
- Silver Flex — kg

Known Orajet baseline for 3164M/3164G:

- Roll width: **460 mm**
- Material weight: **135 g/m² including liner**
- 1 linear metre at 460 mm: **62.1 g = 0.0621 kg**
- 1 kg: **about 16.1 linear metres**

Stock is currently manually adjusted by Production. Automatic job-level material deduction is intentionally not enabled until reliable per-material consumption rules are established.

Do not silently reinterpret numeric stock quantities when changing units. Unit migrations change the stored unit label; review the displayed stock values after deployment.

## 8. Roles and security model

The database roles are:

- `production`
- `branch_admin`
- `branch_user`

A normal branch user must **never** be able to promote themselves to Production or change their branch.

Role/branch changes are controlled by Production staff and the administrative Supabase SQL path. The application UI is not a security boundary; PostgreSQL RLS and triggers are.

### Profile self-escalation protection

`public.prevent_self_privilege_escalation()` prevents authenticated non-production users from changing their own `role` or `branch`.

Administrative SQL Editor sessions do not have `auth.uid()`, so the trigger permits explicit admin maintenance in that context.

This logic is captured in:

`supabase/migrations/202608170002_fix_profile_privilege_admin_updates.sql`

Do not remove the protection just to make testing easier.

## 9. Realtime and machine status

Supabase Realtime is used for live job updates.

The frontend's machine status is **queue-derived/manual application state**, not direct VersaWorks or Roland hardware telemetry. Do not describe it as live machine telemetry unless a real hardware integration is added.

The Netlify configuration must allow:

- Supabase HTTPS
- Supabase secure Realtime WebSocket (`wss:`)

## 10. UI direction

The application uses the approved PostNet Copy & Print visual direction:

- PostNet red, purple, navy and white
- Dark branded sidebar
- PostNet Copy & Print brand mark from `public/postnet-copy-print-mark.webp`
- Roland machine mark from `public/roland-machine-mark.webp`
- Four-card production overview: All / Incoming / In Production / Ready
- Secondary Urgent / Returned for Correction alerts
- Dense Production Board table with pagination
- Clear progress indicators and simplified operator actions
- Guided New Job wizard with live machine-time estimate
- Compact Job Details and Timeline
- Stock and Settings screens optimized for quick production use

Brand assets are intentionally kept in `public/` so they are normal static files, cacheable by the browser and easy to replace without changing application code.

### Updating the artwork

Replace these files while keeping the filenames unchanged:

```text
public/postnet-copy-print-mark.webp
public/roland-machine-mark.webp
```

Use high-resolution artwork with a transparent background and no white rectangular canvas. After replacing the files, run the normal build/test commands and commit the asset changes.

The application references the files by public URL; do not convert the artwork into large Base64 strings in JavaScript.

## 11. Repository architecture

```text
src/
├── app/                 # app bootstrap, state and router
├── components/          # UI rendering components
├── services/            # Supabase API access
├── stores/              # client-side state + realtime subscriptions
├── utils/               # constants, helpers, validation and formatting
├── styles.css           # shared/base styles
├── postnet-ui.css       # branded application UI
└── postnet-board.css    # Production Board layout

public/
├── icon.svg
├── postnet-copy-print-mark.webp
└── roland-machine-mark.webp

supabase/migrations/     # ordered database history
```

Keep the separation of responsibilities. Components should render UI, stores should coordinate client state, and services should contain Supabase calls.

## 12. Development

```powershell
npm install
npm run check
npm run build
npm run dev
```

`npm run check` is intentionally lightweight and currently checks the application entry points. **A passing check is not a substitute for `npm run build`.** Vite/Rollup parses the full application during the build.

Before merging any production change:

1. Run `npm run check`.
2. Run `npm run build`.
3. Start `npm run dev` and test the changed screens in Chrome.
4. Exercise the affected workflow end-to-end.
5. Check the browser console for errors.
6. Keep `main` untouched until the branch is verified.

## 13. Supabase migrations and database upkeep

Migrations are ordered by filename and should be applied once, in order, when setting up a new database.

Important migrations include:

- `202608020003_staff_management.sql` — production staff management policies
- `202608020005_fix_profiles_recursion.sql` — safe `is_production()` helper and corrected profile policies
- `202608020009_workflow_enforcement.sql` — server-side workflow transition enforcement and correction/resubmission rules
- `202608170001_all_stock_units_kg.sql` — standardizes stock units to kg
- `202608170002_fix_profile_privilege_admin_updates.sql` — preserves self-escalation protection while allowing explicit admin SQL profile maintenance

Do **not** rerun already-applied migrations against the production database just because the files exist in the repository.

For a new environment, apply the complete migration history in filename order using the project's normal Supabase migration process.

For a live environment, apply only migrations that are newer than the last successfully applied migration.

### If a live database was manually patched

If a production fix was made directly in Supabase SQL Editor, create or update a migration that records the same final state before the change is considered complete. Otherwise a future database rebuild can silently lose the fix.

## 14. Testing matrix before merge

### New Job

- Step 1 blocks missing customer/reference.
- Step 2 blocks missing/invalid width.
- Step 2 blocks missing/invalid height.
- Step 2 blocks missing/invalid quantity.
- Machine-time estimate updates from size/quantity.
- Step 3 blocks missing artwork confirmations.
- Valid sticker job submits.
- Valid Flex job submits.

### Simplified production workflow

For stickers and Flex:

`Incoming → Start Production → In Production → Mark Ready → Ready → Mark Collected / Sent → Collected`

Verify the internal statuses advance correctly behind the scenes.

Verify Flex never enters Printing/Drying and sticker cutting and Flex cutting remain one visual Cutting context.

### Correction loop

- Production rejects a job with a reason.
- Returned job appears in Needs Attention.
- Owning branch can open it and see the reason.
- Owning branch can resubmit it to Incoming.
- Production sees it as Incoming and can start it again.

### Branch visibility

Test all four stores:

- Plettenberg Bay
- Knysna
- Waterside
- Sedgefield

Branch users must not see jobs belonging to another branch.

### Realtime

Open two authenticated browser sessions and verify job status changes propagate without manual refresh.

### Stock

Verify every material displays `kg` and stock changes are persisted/realtime.

### Role security

Verify a branch user cannot change their own role or branch through the application.

## 15. Deployment

Netlify runs `npm run build` and publishes `dist`.

Required frontend environment variables are configured in Netlify Site settings, not committed to Git:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Never commit service-role keys or other Supabase secrets to the repository.

## 16. Safe release procedure

```powershell
git checkout main
git pull
git checkout -b fix-or-feature/name
git add -A
git commit -m "type: clear description"
git push -u origin fix-or-feature/name
```

Test the branch and its Netlify preview first. Merge only after the build and functional test matrix pass.

After merging:

```powershell
git checkout main
git pull
git status
```

The expected final state is a clean working tree and `main` synchronized with `origin/main`.

## 17. Upkeep rules for future developers and AI agents

Before changing code:

- Read this README.
- Check the current branch and `git status`.
- Read the relevant workflow/config/database code before editing it.
- Ask for clarification instead of inventing a business rule that is not documented.

When changing a workflow:

- Update both the UI logic and database transition enforcement.
- Preserve the simplified operator actions unless the business explicitly requests more manual stages.
- Add/update migrations for database changes.
- Update the testing matrix in this README.

When changing roles/RLS:

- Treat Supabase RLS as the security boundary.
- Never trust a client-side role check alone.
- Do not add self-service privilege escalation.
- Test both allowed and denied cases.

When changing UI:

- Preserve the PostNet Copy & Print visual system.
- Keep the Production Board compact so normal desktop use does not require excessive scrolling.
- Keep branding assets in `public/`.
- Avoid large embedded Base64 images.

When changing database logic:

- Prefer idempotent migrations (`create or replace`, `drop ... if exists` where appropriate).
- Never silently reset live production quantities or jobs.
- Record manual production fixes in a migration before release.

## 18. Current release state

The current UI redesign is developed on the `ui/postnet-copy-print` branch while `main` remains the known-good production branch.

Do not merge the redesign branch until:

- the final brand artwork is supplied
- the full browser test matrix passes
- the four-store visibility tests pass
- the correction/resubmission loop passes
- the Realtime tests pass
- the final Supabase migration set matches the live database
- `npm run check` and `npm run build` both pass
