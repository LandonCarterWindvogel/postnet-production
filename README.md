# PostNet Production

PostNet Production is a browser-based production management PWA for the PostNet Copy & Print workflow. It manages sticker and T-shirt Flex jobs from intake through production and collection, with live Supabase updates, stock visibility, job history and role-based branch access.

## Current production scope

The production system intentionally remains focused on:

- **Stickers** — Gloss Vinyl, Matte Vinyl, Clear Vinyl, Contravision
- **T-shirt Flex** — White Flex, Gold Flex, Silver Flex
- **Production workflows** enforced in both the UI and database
- **Branch visibility** across the configured PostNet stores
- **Stock tracking** by weight in **kilograms (kg)** for every material

### Stores

The configured stores are:

- Plettenberg Bay
- Knysna
- Waterside
- Sedgefield

Production users can assign staff to these branches from Settings. Branch users only see jobs belonging to their own branch.

## Workflows

### Stickers

`Incoming → Queued → Printing → Drying → Cutting → Weeding → Quality Check → Ready → Collected`

The database keeps `contour_cutting` as the internal sticker cutting status.

### T-shirt Flex

`Incoming → Queued → Cutting → Weeding → Heat Press → Quality Check → Ready → Collected`

The database keeps `cutting` as the internal Flex cutting status.

The Production Board deliberately renders both internal cutting statuses as one visual **Cutting** stage.

## Priorities

The application uses the same terminology everywhere:

- **Standard**
- **Rush**
- **Urgent**

Jobs are ordered **Urgent → Rush → Standard**, with FIFO within each priority.

## UI

The current interface uses the PostNet Copy & Print visual direction supplied for the project:

- PostNet red, purple, navy and white brand palette
- Dark branded navigation sidebar
- PostNet Copy & Print mark throughout the application
- Compact production-stage summary strip
- Progress indicators on job cards
- Guided three-step New Job form
- Cleaner Job Details and Timeline presentation
- Stock and Settings cards designed around fast production use
- Responsive desktop, tablet and mobile layouts

The UI redesign does not change the underlying production architecture or workflow rules.

## Stock

All production materials are measured and displayed in **kg**.

The migration `202608170001_all_stock_units_kg.sql` standardizes the stock unit for both sticker and Flex materials. Existing numeric quantities are intentionally not converted automatically; the migration changes the unit interpretation only. Review the values on the Stock page after applying it.

Stock is manually adjusted by production. The application does not guess material consumption because a job does not currently contain a reliable per-unit material usage rate.

## Security

- Row Level Security is enabled on production tables.
- Database workflow transitions are enforced server-side; the UI is not the security boundary.
- Branch users can only access their branch's jobs.
- Production users can manage production data and staff settings.
- The frontend never uses the Supabase `service_role` key.
- User-derived HTML is escaped before rendering.
- Netlify sends security headers and allows Supabase HTTPS and secure Realtime WebSocket connections.

## Development

1. Copy `.env.example` to `.env`.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or the project's configured publishable key).
3. Run `npm install`.
4. Run `npm run dev`.
5. Run `npm run build` before committing production changes.

### Supabase migrations

Apply migrations in filename order when setting up a new database. Do not rerun migrations that have already been applied to the production database.

The latest UI/stock release adds:

`202608170001_all_stock_units_kg.sql`

This migration is safe to rerun and only standardizes the stored unit label to `kg` for the existing stock categories.

## Deployment

Netlify is configured to run `npm run build` and publish `dist`. The site requires the same Supabase environment variables in Netlify Site settings.
