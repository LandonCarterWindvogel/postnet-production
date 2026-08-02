-- Sprint 6: staff management. Previously only "Users can read/update their
-- own profile" existed, so fixing anyone else's role or branch required
-- hand-written SQL in the Supabase editor — exactly what tripped up the
-- Sprint 1 setup. These add production-only read/update access to every
-- profile, the same pattern already used for "Production can manage every
-- job". Self-access policies from the initial schema are untouched and
-- still apply to everyone, including production.

create policy "Production can read every profile" on public.profiles for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'production')
);

create policy "Production can update every profile" on public.profiles for update to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'production')
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'production')
);
