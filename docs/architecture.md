# Architecture

The front end uses Vite and browser-native ES modules. It is intentionally small: the application does not need a framework to provide a reliable production board.

Supabase provides Auth, PostgreSQL, Row Level Security, and (in Sprint 4) Realtime. Netlify builds and hosts the static PWA. The app holds no artwork: the job record only contains the email subject/reference and the artwork confirmation checklist.

## Environment values

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are build-time public client values. They belong in `.env` locally and Netlify environment variables in production. Never put a Supabase service-role key in the front end.
