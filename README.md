# PostNet Production

PostNet Production is a progressive web app for managing sticker and T-shirt flex work from intake through to collection. It deliberately records email artwork references instead of storing artwork files.

## Sprint 1 — Foundation

This release provides the Vite PWA shell, responsive Production Board, login flow, a secure Supabase schema, and the job-intake interface. Job persistence, live queue updates, stock, and notifications are delivered in later sprints.

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
