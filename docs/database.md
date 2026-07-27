# Database setup

1. In Supabase, open **SQL Editor** and run `supabase/migrations/202607270001_initial_schema.sql`.
2. Open **Authentication → Users** and create the first production-centre user.
3. Run the following once, substituting that user’s email:

```sql
update public.profiles
set role = 'production', branch = 'Plettenberg Bay'
where id = (select id from auth.users where email = 'your-email@example.com');
```

New staff accounts receive a branch-user profile automatically. If they belong to another branch, edit their `branch` value in `public.profiles` before they sign in.

Row Level Security means branch users can only read their own branch’s work, while production users can see and manage every job.
