-- ============================================================================
-- RoofBuddy — Sharing fixes
-- 1) my_shares: security_invoker=true blocks reads of auth.users; switch to
--    SECURITY DEFINER and gate rows by auth.uid() = owner_user_id.
-- 2) share_with_email: OUT column "member_user_id" was ambiguous with the
--    account_shares column inside INSERT ... ON CONFLICT. Rename OUT cols.
-- Paste into Supabase → SQL Editor → New query → Run.
-- ============================================================================

-- ─── 1. Recreate my_shares as SECURITY DEFINER, filtered by caller ────────
drop view if exists public.my_shares;

create view public.my_shares
with (security_invoker = false) as
  select
    s.owner_user_id,
    s.member_user_id,
    s.role,
    s.created_at,
    u.email as member_email
  from public.account_shares s
  join auth.users u on u.id = s.member_user_id
  where s.owner_user_id = auth.uid();

grant select on public.my_shares to authenticated;

-- ─── 2. Recreate share_with_email with non-colliding OUT names ────────────
drop function if exists public.share_with_email(text, text);

create or replace function public.share_with_email(
  member_email text,
  member_role  text default 'editor'
)
returns table (out_member_user_id uuid, status text)
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

  select id into v_member
  from auth.users
  where lower(email) = lower(member_email)
  limit 1;

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

-- Done. You should see "Success. No rows returned."
