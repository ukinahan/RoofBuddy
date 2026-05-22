-- ============================================================================
-- Roof Report — Calendar feed tokens (migration 006)
-- Each user can mint a long-lived random token they paste into Apple
-- Calendar / Google Calendar / Outlook as a subscription URL. The /api/
-- calendar/[token].ics route uses the SECURITY DEFINER RPC below to load
-- the user's scheduled inspections without requiring a logged-in session.
-- Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.calendar_feed_tokens (
  token       uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
create index if not exists calendar_feed_tokens_user_idx on public.calendar_feed_tokens (user_id);

alter table public.calendar_feed_tokens enable row level security;

drop policy if exists "calfeed_select_own" on public.calendar_feed_tokens;
drop policy if exists "calfeed_insert_own" on public.calendar_feed_tokens;
drop policy if exists "calfeed_delete_own" on public.calendar_feed_tokens;

create policy "calfeed_select_own" on public.calendar_feed_tokens
  for select using (auth.uid() = user_id);
create policy "calfeed_insert_own" on public.calendar_feed_tokens
  for insert with check (auth.uid() = user_id);
create policy "calfeed_delete_own" on public.calendar_feed_tokens
  for delete using (auth.uid() = user_id);

-- Get-or-create a single active token for the current user (one per user).
create or replace function public.get_or_create_calendar_token()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
begin
  if auth.uid() is null then return null; end if;

  select token into v_token
  from public.calendar_feed_tokens
  where user_id = auth.uid() and revoked_at is null
  order by created_at desc
  limit 1;

  if v_token is null then
    insert into public.calendar_feed_tokens (user_id)
    values (auth.uid())
    returning token into v_token;
  end if;

  return v_token;
end $$;

revoke all on function public.get_or_create_calendar_token() from public, anon;
grant execute on function public.get_or_create_calendar_token() to authenticated;

-- Anon-callable RPC: resolve a token to that user's scheduled inspections
-- (plus any accounts shared into them).
create or replace function public.get_calendar_feed(p_token uuid)
returns table (
  id              uuid,
  customer_name   text,
  address         text,
  scheduled_at    timestamptz,
  pipeline_stage  text,
  inspection_date timestamptz,
  updated_at      timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  select user_id into v_user
  from public.calendar_feed_tokens
  where token = p_token and revoked_at is null;
  if v_user is null then return; end if;

  return query
    select
      i.id,
      coalesce(i.customer_name, i.data->>'customerName'),
      coalesce(i.address, i.data->>'address'),
      i.scheduled_at,
      i.pipeline_stage,
      i.inspection_date,
      i.updated_at
    from public.inspections i
    where i.scheduled_at is not null
      and (
        i.user_id = v_user
        or exists (
          select 1 from public.account_shares s
          where s.owner_user_id = i.user_id and s.member_user_id = v_user
        )
      )
    order by i.scheduled_at;
end $$;

revoke all on function public.get_calendar_feed(uuid) from public;
grant execute on function public.get_calendar_feed(uuid) to anon, authenticated;

-- Done.
