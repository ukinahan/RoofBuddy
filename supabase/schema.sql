-- ============================================================================
-- RoofBuddy — Supabase schema + RLS + storage policies
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Idempotent: safe to re-run if you tweak something.
-- ============================================================================

-- ─── 1. Tables ──────────────────────────────────────────────────────────────
create table if not exists public.inspections (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists inspections_user_idx on public.inspections (user_id, updated_at desc);

create table if not exists public.customers (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists customers_user_idx on public.customers (user_id, updated_at desc);

create table if not exists public.company_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- ─── 2. Enable RLS ──────────────────────────────────────────────────────────
alter table public.inspections      enable row level security;
alter table public.customers        enable row level security;
alter table public.company_profiles enable row level security;

-- ─── 3. RLS policies (drop+recreate so re-runs are clean) ──────────────────
do $$
declare t text;
begin
  for t in select unnest(array['inspections','customers','company_profiles']) loop
    execute format('drop policy if exists "select_own" on public.%I', t);
    execute format('drop policy if exists "insert_own" on public.%I', t);
    execute format('drop policy if exists "update_own" on public.%I', t);
    execute format('drop policy if exists "delete_own" on public.%I', t);
  end loop;
end $$;

create policy "select_own" on public.inspections      for select using (auth.uid() = user_id);
create policy "insert_own" on public.inspections      for insert with check (auth.uid() = user_id);
create policy "update_own" on public.inspections      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own" on public.inspections      for delete using (auth.uid() = user_id);

create policy "select_own" on public.customers        for select using (auth.uid() = user_id);
create policy "insert_own" on public.customers        for insert with check (auth.uid() = user_id);
create policy "update_own" on public.customers        for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own" on public.customers        for delete using (auth.uid() = user_id);

create policy "select_own" on public.company_profiles for select using (auth.uid() = user_id);
create policy "insert_own" on public.company_profiles for insert with check (auth.uid() = user_id);
create policy "update_own" on public.company_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own" on public.company_profiles for delete using (auth.uid() = user_id);

-- ─── 4. updated_at auto-touch trigger ──────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end $$ language plpgsql;

drop trigger if exists touch_inspections      on public.inspections;
drop trigger if exists touch_customers        on public.customers;
drop trigger if exists touch_company_profiles on public.company_profiles;
create trigger touch_inspections      before update on public.inspections      for each row execute function public.touch_updated_at();
create trigger touch_customers        before update on public.customers        for each row execute function public.touch_updated_at();
create trigger touch_company_profiles before update on public.company_profiles for each row execute function public.touch_updated_at();

-- ─── 5. Storage policies (bucket itself: create in UI, see step below) ─────
-- Path convention: <user_id>/<inspection_id>/<photo_id>.jpg
do $$
begin
  drop policy if exists "photos_select_own" on storage.objects;
  drop policy if exists "photos_insert_own" on storage.objects;
  drop policy if exists "photos_update_own" on storage.objects;
  drop policy if exists "photos_delete_own" on storage.objects;
exception when others then null;
end $$;

create policy "photos_select_own" on storage.objects for select
  using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "photos_insert_own" on storage.objects for insert
  with check (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "photos_update_own" on storage.objects for update
  using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "photos_delete_own" on storage.objects for delete
  using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- Done. You should see "Success. No rows returned."
