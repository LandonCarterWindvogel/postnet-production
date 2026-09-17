# PostNet Production

This is the production-management app I am building for the PostNet Copy & Print workflow.

I built it because the real workflow is not complicated enough to deserve a CRM, an ERP and seventeen dashboards. I need to know what came in, what needs attention, what is being produced and what is ready to go out the door.

So that is what this app is designed to do.

It is a browser-based PWA using Supabase for the backend and realtime updates. The supported production work is stickers and T-shirt Flex.

## What I am solving

The Production Centre handles jobs for:

- Plettenberg Bay
- Knysna
- Waterside
- Sedgefield

The operator workflow is deliberately simple:

```text
Submitted / Incoming → In Production → Ready → Collected / Sent
```

The database still records detailed internal production states for auditing, timelines and future reporting. The operator does not need to babysit every machine state on screen.

## Supported jobs

### Stickers

- Gloss Vinyl
- Matte Vinyl
- Clear Vinyl
- Contravision

Internal workflow:

```text
Incoming → Queued → Printing → Drying → Cutting → Weeding → Quality Check → Ready → Collected
```

Sticker cutting uses the database state `contour_cutting`.

### T-shirt Flex

- White Flex
- Gold Flex
- Silver Flex

Internal workflow:

```text
Incoming → Queued → Cutting → Weeding → Heat Press → Quality Check → Ready → Collected
```

Flex cutting uses the database state `cutting`.

Both workflows appear as **In Production** to the operator. I want the UI simple without throwing away useful detail underneath.

## Priorities

I use three priority levels:

- **Standard**
- **Rush**
- **Urgent**

The Production Board sorts them:

```text
Urgent → Rush → Standard
```

Jobs at the same priority remain FIFO by creation time.

## Production Board

The main views are:

- **All** — active jobs excluding collected and rejected jobs
- **Incoming** — jobs waiting for Production to start
- **In Production** — queued jobs and internal production states
- **Ready** — completed jobs waiting for collection or handover

Urgent and Returned for Correction counts remain visible as secondary alerts.

I keep permanent Store Views for All Branches and every store. A store with zero jobs should not disappear just because it is having a quiet day.

## Correction workflow

A job that needs artwork correction follows a separate loop:

```text
Active → Rejected → Incoming → Queued → ...
```

Production sends it back with a reason. The owning branch corrects the artwork and resubmits it to `Incoming`.

This is not a normal backwards production transition. The database trigger is the final authority on allowed status changes.

## New Job

The New Job wizard has three steps:

1. Job Information
2. Sizes & Materials
3. Review & Submit

Width, height and quantity must be valid before the user can continue, and the artwork checklist is required before submission.

I handle these validation messages in the application instead of relying on hidden browser form controls. Chrome can produce `invalid form control ... is not focusable` when an invalid field lives inside a hidden wizard panel, and I have no interest in debugging that nonsense at 4:30pm.

## Machine-time estimator

The estimator means **machine production time: Print + Cut**.

It excludes design, drying, weeding, heat pressing, quality control, queue/waiting time and collection/courier time.

Current sticker anchors:

| Size | Quantity | Estimate |
|---|---:|---:|
| 50×50 mm | 100 | ~35–40 min |
| 50×50 mm | 500 | ~3 h |
| 100×50 mm | 100 | ~45–55 min |
| 100×50 mm | 500 | ~4.5 h |
| 200×100 mm | 100 | ~2.5 h |

Current Flex anchors:

| Size | Quantity | Estimate |
|---|---:|---:|
| 100×100 mm | 10 | ~15–20 min |
| 200×200 mm | 10 | ~45–60 min |
| 200×200 mm | 25 | ~2 h |
| 300×300 mm | 25 | ~3.5–4 h |

The estimator uses the midpoint of the observed ranges and interpolates between valid size/quantity combinations.

This is a machine-time estimate, **not a customer completion promise**.

The estimator lives in:

```text
src/utils/machineTime.js
```

A historical VersaWorks/BN-20 CSV export is available for future validation. Before I use it for automated fitting, I need to clean malformed rows and verify the data.

## Stock

All stock is stored in **kilograms (kg)**.

Materials:

- Gloss Vinyl
- Matte Vinyl
- Clear Vinyl
- Contravision
- White Flex
- Gold Flex
- Silver Flex

Known Orajet 3164M/3164G baseline:

- Roll width: **460 mm**
- Material weight: **135 g/m² including liner**
- 1 linear metre at 460 mm: **62.1 g / 0.0621 kg**
- 1 kg: **about 16.1 linear metres**

Stock is manually adjusted by Production for now. Automatic job-level deduction stays disabled until reliable consumption rules exist for each material.

## Security and roles

Database roles are:

- `production`
- `branch_admin`
- `branch_user`

A branch user must never be able to promote themselves to Production or change their branch.

The UI is not the security boundary. PostgreSQL RLS and database triggers are.

`public.prevent_self_privilege_escalation()` prevents authenticated non-production users from changing their own role or branch.

The relevant migration is:

```text
supabase/migrations/202608170002_fix_profile_privilege_admin_updates.sql
```

I should not remove this protection just because testing would be slightly more convenient without it.

## Realtime and machine status

Supabase Realtime handles live job and stock updates.

The frontend machine status is application/queue state. It is **not** direct VersaWorks or Roland hardware telemetry.

If I ever add actual hardware integration, then I can call it machine telemetry. Until then, a status card is just a status card.

Netlify needs to allow Supabase HTTPS and secure Realtime WebSocket (`wss:`).

## Architecture

```text
src/
├── app/                 # bootstrap, state and router
├── components/          # UI rendering
├── services/            # Supabase API access
├── stores/              # client state and realtime subscriptions
├── utils/               # constants, validation, formatting and helpers
├── styles.css           # shared/base styles
├── postnet-ui.css       # branded UI
└── postnet-board.css    # Production Board layout

public/
├── icon.svg
├── postnet-copy-print-mark.webp
└── roland-machine-mark.webp

supabase/migrations/     # ordered database history
```

I keep the responsibilities separated: components render, stores coordinate state and services talk to Supabase.

## Development

```powershell
npm install
npm run check
npm run build
npm run dev
```

`npm run check` is intentionally lightweight. A passing check does not replace `npm run build` because Vite/Rollup parses the full application during the build.

Before merging I:

1. Run `npm run check`.
2. Run `npm run build`.
3. Test the changed screens in Chrome.
4. Test the affected workflow end-to-end.
5. Check the browser console.
6. Keep `main` untouched until the change is verified.

## Database migrations

Migrations are ordered by filename and should be applied once, in order, when setting up a new environment.

Important workflow/security migrations include:

- `202608020003_staff_management.sql`
- `202608020005_fix_profiles_recursion.sql`
- `202608020009_workflow_enforcement.sql`
- `202608170001_all_stock_units_kg.sql`
- `202608170002_fix_profile_privilege_admin_updates.sql`
- `202608240001_fix_rejection_transition_order.sql`
- `202608240002_fix_job_state_array_position_cast.sql`

I do **not** rerun old migrations against a live database just because the files are sitting in the repository looking useful.

For a new environment I apply the complete history in filename order. For an existing environment I apply only migrations newer than the last successfully applied migration.

If I manually patch production in Supabase SQL Editor, I record the final state in a migration before considering the fix complete.

For workflow changes I verify the actual live function/trigger after applying the migration.

## Testing checklist

I test the New Job validation, sticker workflow, Flex workflow, correction loop, all four branch views, realtime updates, stock persistence and role security.

For both job types the operator flow should remain:

```text
Incoming → Start Production → In Production → Mark Ready → Ready → Mark Collected / Sent → Collected
```

Before merge I also check for:

- `ERR_INVALID_URL`
- `invalid form control ... is not focusable`
- uncaught JavaScript errors
- Supabase Realtime errors
- failed `npm run check`
- failed `npm run build`

## Deployment

Netlify builds with `npm run build` and publishes `dist`.

Frontend environment variables belong in Netlify Site settings:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

I never commit service-role keys or other secrets to Git.

## Safe release flow

```powershell
git checkout main
git pull
git checkout -b fix-or-feature/name
git add -A
git commit -m "type: clear description"
git push -u origin fix-or-feature/name
```

I test the branch and its Netlify preview before merging.

After merging:

```powershell
git checkout main
git pull
git status
```

I want a clean working tree and `main` synchronized with `origin/main`.

## Rules for future me — and future AI assistants

Before changing code:

- Read this README.
- Check the branch and `git status`.
- Read the relevant workflow, configuration or database code first.
- Ask instead of inventing a business rule.

When changing workflow logic:

- Update both UI and database enforcement.
- Preserve the simplified operator actions unless the business explicitly asks for more manual stages.
- Add/update migrations and the testing checklist.
- Test stickers and Flex separately.
- Keep `incoming → rejected` ahead of the `incoming → queued` acceptance rule.
- Cast enum values to text before using them with `text[]` functions such as `array_position()`.

When changing roles/RLS:

- Treat Supabase RLS as the security boundary.
- Never trust a client-side role check alone.
- Do not introduce self-service privilege escalation.
- Test both allowed and denied cases.

When changing the UI:

- Preserve the PostNet Copy & Print visual system.
- Keep the Production Board compact.
- Keep brand assets in `public/`.
- Do not turn normal images into giant Base64 blobs.

When changing database logic:

- Prefer idempotent migrations where appropriate.
- Never silently reset production quantities or jobs.
- Record manual production fixes in migrations.
- Verify live workflow functions/triggers after database changes.

## Final reminder

This app exists to make production easier, not to win a competition for Most Complicated Dashboard.

If a change makes the system clearer, safer and faster to use, I am probably on the right track.

If a change requires a 47-page explanation for someone to print one sticker, I have probably gone too far.
