-- ============================================================================
-- RoofBuddy — Account sharing migration (additive, idempotent)
-- Lets one user (the "owner") grant another user (the "member") access to
-- their inspections, customers, company profile, and photos.
-- Paste into Supabase → SQL Editor → New query → Run.
-- ============================================================================

-- ─── 1. account_shares table ───────────────────────────────────────────────
create table if not exists public.account_shares (
  owner_user_id  uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  role           text not null default 'editor' check (role in ('viewer','editor')),
  created_at     timestamptz not null default now(),
  primary key (owner_user_id, member_user_id),
  check (owner_user_id <> member_user_id)
);
create index if not exists account_shares_member_idx on public.account_shares (member_user_id);

alter table public.account_shares enable row level security;

-- Owner sees their grants; member sees grants pointed at them.
drop policy if exists "shares_select_own"    on public.account_shares;
drop policy if exists "shares_select_member" on public.account_shares;
drop policy if exists "shares_insert_owner"  on public.account_shares;
drop policy if exists "shares_delete_owner"  on public.account_shares;

create policy "shares_select_own"    on public.account_shares
  for select using (auth.uid() = owner_user_id);
create policy "shares_select_member" on public.account_shares
  for select using (auth.uid() = member_user_id);
create policy "shares_insert_owner"  on public.account_shares
  for insert with check (auth.uid() = owner_user_id);
create policy "shares_delete_owner"  on public.account_shares
  for delete using (auth.uid() = owner_user_id);

-- ─── 2. Helper: is current user a shared member of <owner>? ────────────────
create or replace function public.is_shared_with(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.account_shares
    where owner_user_id = p_owner
      and member_user_id = auth.uid()
  );
$$;

-- ─── 3. Add shared SELECT/UPDATE policies to existing tables ──────────────
-- (Original _own policies remain untouched — sharing is purely additive.)

drop policy if exists "select_shared" on public.inspections;
drop policy if exists "update_shared" on public.inspections;
create policy "select_shared" on public.inspections
  for select using (public.is_shared_with(user_id));
create policy "update_shared" on public.inspections
  for update using (public.is_shared_with(user_id))
  with check  (public.is_shared_with(user_id));

drop policy if exists "select_shared" on public.customers;
drop policy if exists "update_shared" on public.customers;
create policy "select_shared" on public.customers
  for select using (public.is_shared_with(user_id));
create policy "update_shared" on public.customers
  for update using (public.is_shared_with(user_id))
  with check  (public.is_shared_with(user_id));

drop policy if exists "select_shared" on public.company_profiles;
create policy "select_shared" on public.company_profiles
  for select using (public.is_shared_with(user_id));

-- ─── 4. Storage: let shared members read the owner's photos ───────────────
drop policy if exists "photos_select_shared" on storage.objects;
create policy "photos_select_shared" on storage.objects for select
  using (
    bucket_id = 'photos'
    and public.is_shared_with(((storage.foldername(name))[1])::uuid)
  );

-- ─── 5. RPC: grant share access by email (avoids exposing auth.users) ─────
-- The caller (auth.uid()) becomes the owner. The target user must already
-- have signed in at least once (so a row exists in auth.users).
create or replace function public.share_with_email(member_email text, member_role text default 'editor')
returns table (member_user_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid;
begin
  if auth.uid() is null then
    return query select null::uuid, 'unauthorized'::text;
    return;
  end if;

  if member_role not in ('viewer','editor') then
    return query select null::uuid, 'invalid_role'::text;
    return;
  end if;

  select id into v_member from auth.users where lower(email) = lower(member_email) limit 1;

  if v_member is null then
    return query select null::uuid, 'not_registered'::text;
    return;
  end if;

  if v_member = auth.uid() then
    return query select v_member, 'self'::text;
    return;
  end if;

  insert into public.account_shares (owner_user_id, member_user_id, role)
  values (auth.uid(), v_member, member_role)
  on conflict (owner_user_id, member_user_id) do update set role = excluded.role;

  return query select v_member, 'ok'::text;
end;
$$;

revoke all on function public.share_with_email(text, text) from public;
grant execute on function public.share_with_email(text, text) to authenticated;

-- Companion view: list current owner's shares with member emails resolved.
create or replace view public.my_shares with (security_invoker = true) as
  select s.owner_user_id, s.member_user_id, s.role, s.created_at, u.email as member_email
  from public.account_shares s
  join auth.users u on u.id = s.member_user_id
  where s.owner_user_id = auth.uid();

grant select on public.my_shares to authenticated;

-- Done. You should see "Success. No rows returned."
