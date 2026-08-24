# Database setup

1. In Supabase, open **SQL Editor** and run every migration in `supabase/migrations/` in filename order when setting up a new database. Do not rerun migrations that have already been applied to an existing production database.
2. Open **Authentication → Users** and create the first production-centre user. Creating Auth users belongs in the Supabase dashboard; the `service_role` key must never be placed in the frontend.
3. Promote that first account to production once:

```sql
update public.profiles
set role = 'production', branch = 'Plettenberg Bay'
where id = (select id from auth.users where email = 'your-email@example.com');
```

New staff accounts receive a branch-user profile automatically. A production user can then change anyone's name, branch, or role from **Settings**.

## Configured stores

The application currently supports these PostNet stores:

- Plettenberg Bay
- Knysna
- Waterside
- Sedgefield

These values are represented by the existing `branch_name` enum and are used by job routing, branch visibility and staff assignment.

## Stock units

All stock is measured by **weight in kilograms (kg)**, including T-shirt Flex.

The migration `202608170001_all_stock_units_kg.sql` updates the stored `unit` value to `kg` for both `stickers` and `flex` categories without changing the numeric quantity already stored. Review the Stock page after applying the migration so any historical numbers can be corrected if they were entered under a previous unit interpretation.

Stock is manually adjusted by production because there is currently no reliable per-job material consumption rate to deduct automatically.

## Access control

Row Level Security means branch users can only read their own branch's work, while production users can see and manage every job, profile and stock item. Production-only actions are enforced by database policies/triggers as well as the frontend UI.
