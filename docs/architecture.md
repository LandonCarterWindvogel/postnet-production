# Architecture

The front end uses Vite and browser-native ES modules. It is intentionally small: the application does not need a framework to provide a reliable production board.

Supabase provides Auth, PostgreSQL, Row Level Security, and (in Sprint 4) Realtime. Netlify builds and hosts the static PWA. The app holds no artwork: the job record only contains the email subject/reference and the artwork confirmation checklist.

## Module layout (Sprint 3)

Still no framework and no build-time templating — every view is a plain function that returns an HTML string, and `app.js` sets `innerHTML` on a single re-render. What changed is that this is now split by responsibility instead of living in one file:

- **`app/`** — `app.js` wires the DOM, stores, and router together and owns all event listeners; `router.js` maps a page id to a view; `state.js` tracks navigation only (current page, selected job)
- **`stores/`** — `authStore.js` and `jobStore.js` each hold one slice of server-backed state and a small `subscribe(listener)` / `notify()` pair; nothing outside a store calls Supabase directly
- **`components/`** — one file per screen, grouped by domain (`board/`, `jobs/`, `layout/`, `auth/`), each exporting a pure `render*()` function
- **`utils/`** — no side effects: `constants.js` (labels/options), `formatters.js` + `dates.js` (display strings), `helpers.js` (workflow-step logic), `validators.js` (form checks)

Adding a new screen means: add a component, add a case in `router.js`, add a nav entry in `config.js`. Adding new server state means: add a store, subscribe to it in `app.js`.

## Environment values

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are build-time public client values. They belong in `.env` locally and Netlify environment variables in production. Never put a Supabase service-role key in the front end.
