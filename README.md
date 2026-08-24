# PostNet Production

PostNet Production is a browser-based production management PWA for the PostNet Copy & Print workflow. It manages sticker and T-shirt Flex jobs from intake through production and collection, with live Supabase updates, stock visibility, job history, correction/resubmission workflow, role-based branch access, and machine-time estimates for the BN-20 production portion.

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

## 2. Production workflows

### Stickers

Internal workflow:

`Incoming → Queued → Printing → Drying → Cutting → Weeding → Quality Check → Ready → Collected`

Internal database status for the sticker Cutting stage is `contour_cutting`.

### T-shirt Flex

Internal workflow:

`Incoming → Queued → Cutting → Weeding → Heat Press → Quality Check → Ready → Collected`

Internal database status for Flex Cutting is `cutting`.

The Production Board intentionally presents both internal cutting statuses as one visual **Cutting** stage. Do not create a second visual Cutting column unless the underlying workflow is intentionally changed.

### Simplified production controls

Operators do **not** need to click every internal stage manually.

The main production actions are:

- **Start Production** — moves `Incoming`/`Queued` through the queue and into the first machine stage (`Printing` for stickers, `Cutting` for Flex).
- **Mark Ready** — advances the job through its remaining internal production stages to `Ready` in one operator action.
- **Mark Collected / Sent** — closes a `Ready` job as `Collected`.

The detailed internal statuses remain in the database for audit history, reporting, queue-derived machine state, and future automation. The simplified actions only reduce the number of manual clicks; they do not remove the underlying workflow.

### Returned for correction

Any active job may be returned by Production for correction:

`Active → Rejected → Incoming → Queued → ...`

The owning branch is responsible for correcting the artwork and resubmitting the job to `Incoming`. Production then accepts it back into the queue.

This is a separate correction loop, not a backwards production transition. The database trigger is the final authority for allowed status changes.

## 3. Machine-time estimator

The New Job wizard captures **width, height and quantity** for both stickers and T-shirt Flex.

The application calculates an **Estimated Machine Time** from the supplied production baselines. This estimate represents only the machine portion:

> **Print + cut only**

It explicitly excludes:

- queue waiting time
- design time
- sticker drying
- weeding
- heat pressing
- quality control
- collection/courier/driver time

Current baseline anchors are maintained in `src/utils/machineTime.js` and come from observed production timings supplied for the client demo:

### Stickers / Decals

| Size | Quantity | Baseline |
|---|---:|---:|
| 50×50 mm | 100 | 35–40 min |
| 50×50 mm | 500 | ~3 h |
| 100×50 mm | 100 | 45–55 min |
| 100×50 mm | 500 | ~4.5 h |
| 200×100 mm | 100 | ~2.5 h |

### Flex / HTV

| Size | Quantity | Baseline |
|---|---:|---:|
| 100×100 mm | 10 | 15–20 min |
| 200×200 mm | 10 | 45–60 min |
| 200×200 mm | 25 | ~2 h |
| 300×300 mm | 25 | 3.5–4 h |

The estimator uses these anchors to produce a practical estimate for sizes and quantities between the supplied examples. It is an **estimate**, not a promise of completion time.

### VersaWorks job-log data

A historical `Job Log.csv` export was supplied from the BN-20/VersaWorks workflow. It contains thousands of production records, including `Print Start Time`, `Print End Time`, dimensions, copy counts, media names and ink consumption. This data is valuable for improving the estimator later because real machine durations can be compared against the current baseline anchors.

When the log is cleaned and normalized, the safest machine-duration definition for future calibration is `Print Start Time → Print End Time`.

Do not replace the current client-approved baselines with raw CSV-derived averages until the log has been validated and the job types/media have been separated correctly.

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

Step 2 requires:

- width in millimetres greater than 0
- height in millimetres greater than 0
- quantity as a whole number of at least 1

The application generates the human-readable specification automatically as `Width × Height mm`.

Step 3 requires the artwork checklist before the job is inserted.

The browser's native hidden-control validation must not be relied upon because hidden wizard panels can cause Chrome's `invalid form control ... is not focusable` error. Application-side validation is the source of the user-facing wizard errors, while Supabase constraints remain the server-side backstop.

## 6. Stock

**All stock is measured in kilograms (kg).**

Materials:

- Gloss Vinyl — kg
- Matte Vinyl — kg
- Clear Vinyl — kg
- Contravision — kg
- White Flex — kg
- Gold Flex — kg
- Silver Flex — kg

Stock is manually adjusted by Production. The application currently does **not** automatically deduct material from jobs because reliable usage-per-job rules for every material have not been finalized.

### Confirmed Orajet stock baseline

For **Orajet 3164M and 3164G**:

- density including liner: **135 g/m²**
- roll width: **460 mm**
- weight per linear metre: **0.46 × 135 = 62.1 g/m**
- weight per metre: **0.0621 kg/m**
- 1 kg: approximately **16.10 m**
- 10 kg: approximately **161.0 m**
- 20 kg: approximately **322.1 m**

These values are appropriate as a known stock reference. Do not assume the same grams-per-metre value for Flex or other media without confirming its own material specification.

Do not silently reinterpret numeric stock quantities when changing units. Unit migrations change the stored unit label; review the displayed stock values after deployment.

## 7. Roles and security model

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

## 8. Realtime and machine status

Supabase Realtime is used for live job updates.

The frontend's machine status is **queue-derived/manual application state**, not direct VersaWorks or Roland hardware telemetry. Do not describe it as live machine telemetry unless a real hardware integration is added.

The Netlify configuration must allow:

- Supabase HTTPS
- Supabase secure Realtime WebSocket (`wss:`)

## 9. UI direction

The application uses the approved PostNet Copy & Print visual direction:

- PostNet red, purple, navy and white
- Dark branded sidebar
- PostNet Copy & Print brand mark from `public/postnet-copy-print-mark.webp`
- Roland machine mark from `public/roland-machine-mark.webp`
- Compact production-stage summary strip
- Dense Production Board table with pagination
- Clear progress indicators
- Guided New Job wizard
- Machine-time estimate card in New Job
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

## 10. Repository architecture

```text
src/
├── app/                 # app bootstrap, state and router
├── components/          # UI rendering components
├── services/            # Supabase API access
├── stores/              # client-side state + realtime subscriptions
├── utils/               # constants, machine-time model, helpers, validation and formatting
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

## 11. Development

```powershell
npm install
npm run check
npm run build
npm run dev
```

`npm run check` is intentionally lightweight and currently checks the application entry points. **A passing check is not a substitute for `npm run build`.** Vite/Rollup parses the full application during the build and has already caught template/runtime syntax issues that the lightweight check could not catch.

Before merging any production change:

1. Run `npm run check`.
2. Run `npm run build`.
3. Start `npm run dev` and test the changed screens in Chrome.
4. Exercise the affected workflow end-to-end.
5. Check the browser console for errors.
6. Keep `main` untouched until the branch is verified.

## 12. Supabase migrations and database upkeep

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

## 13. Testing matrix before merge

### New Job

- Step 1 blocks missing customer/reference.
- Step 2 blocks missing width.
- Step 2 blocks missing height.
- Step 2 blocks missing/invalid quantity.
- Machine-time estimate updates from size + quantity.
- Estimate is explicitly labelled Print + Cut machine time only.
- Step 3 blocks missing artwork confirmations.
- Valid sticker job submits.
- Valid Flex job submits.

### Simplified production controls

- Production sees **Start Production** for `Incoming`/`Queued`.
- Sticker Start Production reaches `Printing` internally.
- Flex Start Production reaches `Cutting` internally.
- Production sees **Mark Ready** during active production.
- Mark Ready reaches `Ready` while preserving internal event history.
- Production sees **Mark Collected / Sent** at `Ready`.
- No requirement to manually click every internal stage.

### Correction loop

- Production rejects a job with a reason.
- Returned job appears in Needs Attention.
- Owning branch can open it and see the reason.
- Owning branch can resubmit it to Incoming.
- Production sees it as Incoming and can accept it again.

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

## 14. Deployment

Netlify runs `npm run build` and publishes `dist`.

Required frontend environment variables are configured in Netlify Site settings, not committed to Git:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Never commit service-role keys or other Supabase secrets to the repository.

## 15. Safe release procedure

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

## 16. Upkeep rules for future developers and AI agents

Before changing code:

- Read this README.
- Check the current branch and `git status`.
- Read the relevant workflow/config/database code before editing it.
- Ask for clarification instead of inventing a business rule that is not documented.

When changing a workflow:

- Update both the UI logic and database transition enforcement.
- Add/update migrations for database changes.
- Update the testing matrix in this README.
- Keep the simplified operator actions understandable even when the underlying statuses remain detailed.

When changing the machine-time estimator:

- Keep the estimate explicitly limited to the machine portion unless the business requirement changes.
- Update `src/utils/machineTime.js` when the client supplies new baseline timings.
- Do not replace approved baselines with raw historical averages until historical job logs have been cleaned, classified and validated.

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

## 17. Current release state

The current UI redesign and workflow improvements are developed on the `ui/postnet-copy-print` branch while `main` remains the known-good production branch.

Do not merge the redesign branch until:

- the final brand artwork is supplied
- the New Job estimator has been browser-tested for stickers and Flex
- the simplified production actions have been browser-tested
- the four-store visibility tests pass
- the correction/resubmission loop passes
- the Realtime tests pass
- the final Supabase migration set matches the live database
- `npm run check` and `npm run build` both pass
