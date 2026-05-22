-- ============================================================================
-- RoofBuddy — Secure my_shares
-- Supabase advisor flagged public.my_shares as "Exposed Auth Users" because
-- the view joins auth.users and is granted to authenticated. Even though the
-- view filters by auth.uid(), exposing any view over auth.users via PostgREST
-- is brittle and trips the linter.
--
-- Fix: drop the view, expose the same data via a SECURITY DEFINER RPC.
-- The function is the only thing granted to authenticated; auth.users stays
-- unexposed.
-- Paste into Supabase -> SQL Editor -> New query -> Run.
-- ============================================================================

drop view if exists public.my_shares;

create or replace function public.list_my_shares()
returns table (
  member_user_id uuid,
  member_email   text,
  role           text,
  created_at     timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.member_user_id,
    u.email::text as member_email,
    s.role,
    s.created_at
  from public.account_shares s
  join auth.users u on u.id = s.member_user_id
  where s.owner_user_id = auth.uid()
  order by s.created_at desc;
$$;

-- Default privileges on public schema in Supabase auto-grant EXECUTE to
-- anon, authenticated, and service_role. Revoke from anon explicitly so
-- only signed-in users (where auth.uid() is non-null) can call this.
revoke all on function public.list_my_shares() from public, anon;
grant execute on function public.list_my_shares() to authenticated;

-- Done. You should see "Success. No rows returned."
