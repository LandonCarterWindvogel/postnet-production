# Database setup

1. In Supabase, open **SQL Editor** and run every file in `supabase/migrations/` in filename order (they're dated, so sorting by name is sorting by order).
2. Open **Authentication → Users** and create the first production-centre user — this one bootstrap step still needs the Supabase dashboard, since creating a login requires the `service_role` key, which never belongs in the front end (see `docs/architecture.md`).
3. Run the following once, substituting that user's email, to make them the first production user:

```sql
update public.profiles
set role = 'production', branch = 'Plettenberg Bay'
where id = (select id from auth.users where email = 'your-email@example.com');
```

New staff accounts receive a branch-user profile automatically. From here on, a production user can change anyone's name, branch, or role from the app's **Settings** page — no more manual SQL for that part. The direct-SQL step above is only ever needed once, to promote the very first account, because until someone is `production` there's no one who can use Settings to promote the next person.

Row Level Security means branch users can only read their own branch's work, while production users can see and manage every job, every profile, and every stock item. A trigger (`supabase/migrations/202608020004_qa_rls_hardening.sql`) blocks a non-production user from changing their own `role` or `branch` even via a direct API call — Settings is the only path to changing those fields for anyone but yourself.
