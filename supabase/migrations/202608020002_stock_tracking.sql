-- Sprint 5: material stock tracking for stickers and T-shirt flex.
-- Levels are adjusted manually by production; there is no automatic
-- deduction on job creation (jobs don't record a per-unit consumption rate,
-- and guessing one would be worse than an honest manual count).

create type public.stock_category as enum ('stickers', 'flex');

create table public.stock_items (
  id uuid primary key default gen_random_uuid(),
  material text not null unique check (char_length(trim(material)) between 2 and 80),
  category public.stock_category not null,
  unit text not null check (char_length(trim(unit)) between 1 and 20),
  quantity_on_hand numeric not null default 0 check (quantity_on_hand >= 0),
  low_stock_threshold numeric not null default 0 check (low_stock_threshold >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create index stock_items_category_idx on public.stock_items (category);

alter table public.stock_items enable row level security;

create policy "Everyone signed in can read stock" on public.stock_items for select to authenticated using (true);
create policy "Production can manage stock" on public.stock_items for update to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'production')
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'production')
);

-- Seed the materials that already exist as options on the New Job form
-- (src/utils/constants.js MATERIALS). Starting levels and thresholds are 0/0
-- placeholders — set real counts from the Stock page after this migration runs.
insert into public.stock_items (material, category, unit, quantity_on_hand, low_stock_threshold) values
  ('Gloss Vinyl', 'stickers', 'm', 0, 0),
  ('Matte Vinyl', 'stickers', 'm', 0, 0),
  ('Clear Vinyl', 'stickers', 'm', 0, 0),
  ('Contravision', 'stickers', 'm', 0, 0),
  ('White Flex', 'flex', 'sheets', 0, 0),
  ('Gold Flex', 'flex', 'sheets', 0, 0),
  ('Silver Flex', 'flex', 'sheets', 0, 0);

alter publication supabase_realtime add table public.stock_items;
