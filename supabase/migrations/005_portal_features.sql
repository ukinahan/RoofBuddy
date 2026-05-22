-- ============================================================================
-- Roof Report — Portal features foundation (migration 005)
-- Adds the schema needed for:
--   • Pipeline board (pipeline_stage column on inspections)
--   • Calendar / scheduling (scheduled_at)
--   • Map view (latitude / longitude denormalised)
--   • Public quote-accept link (public_quote_tokens, accept_public_quote RPC)
--   • Email + PDF tracking (tracking_events + log_tracking_event RPC)
--   • Activity log (inspection_activity + auto trigger)
--   • Warranty reminders (warranty_reminders + auto-create on completion)
--   • Role-based team access (extend account_shares.role to admin)
-- Idempotent — safe to re-run.
-- ============================================================================

-- ─── 1. Denormalised columns on inspections ────────────────────────────────
alter table public.inspections
  add column if not exists pipeline_stage text
    check (pipeline_stage in ('lead','inspected','quoted','accepted','scheduled','completed'))
    default 'inspected',
  add column if not exists scheduled_at  timestamptz,
  add column if not exists completed_at  timestamptz,
  add column if not exists latitude      double precision,
  add column if not exists longitude     double precision,
  add column if not exists customer_id   uuid,
  add column if not exists customer_name text,
  add column if not exists address       text,
  add column if not exists inspection_date timestamptz,
  add column if not exists quote_total   numeric(12,2);

create index if not exists inspections_pipeline_idx on public.inspections (user_id, pipeline_stage);
create index if not exists inspections_scheduled_idx on public.inspections (user_id, scheduled_at);
create index if not exists inspections_completed_idx on public.inspections (user_id, completed_at);
create index if not exists inspections_geo_idx on public.inspections (user_id) where latitude is not null and longitude is not null;

-- Sync trigger: pull common fields out of the jsonb on every write so the
-- portal can filter / sort without scanning every row.
create or replace function public.inspections_sync_denorm() returns trigger as $$
declare
  d jsonb := coalesce(new.data, '{}'::jsonb);
  qi jsonb;
  total numeric := 0;
  item jsonb;
begin
  new.customer_id     := nullif(d->>'customerId','')::uuid;
  new.customer_name   := d->>'customerName';
  new.address         := d->>'address';
  new.latitude        := nullif(d->>'latitude','')::double precision;
  new.longitude       := nullif(d->>'longitude','')::double precision;
  new.inspection_date := nullif(d->>'date','')::timestamptz;

  -- Preserve an existing pipeline_stage in the column if jsonb has none.
  if d ? 'pipelineStage' then
    new.pipeline_stage := d->>'pipelineStage';
  elsif new.pipeline_stage is null then
    new.pipeline_stage := case
      when coalesce(jsonb_array_length(d->'photos'),0) = 0 then 'lead'
      when coalesce(jsonb_array_length(d->'quoteItems'),0) > 0 then 'quoted'
      else 'inspected'
    end;
  end if;

  new.scheduled_at := nullif(d->>'scheduledAt','')::timestamptz;
  new.completed_at := nullif(d->>'completedAt','')::timestamptz;

  qi := d->'quoteItems';
  if qi is not null and jsonb_typeof(qi) = 'array' then
    for item in select * from jsonb_array_elements(qi) loop
      total := total + coalesce((item->>'qty')::numeric,0) * coalesce((item->>'unitPrice')::numeric,0);
    end loop;
    new.quote_total := total;
  else
    new.quote_total := null;
  end if;

  return new;
end $$ language plpgsql;

drop trigger if exists inspections_sync_denorm on public.inspections;
create trigger inspections_sync_denorm
  before insert or update on public.inspections
  for each row execute function public.inspections_sync_denorm();

-- Backfill once.
update public.inspections set data = data where pipeline_stage is null or customer_name is null;

-- ─── 2. account_shares: add admin role ─────────────────────────────────────
alter table public.account_shares drop constraint if exists account_shares_role_check;
alter table public.account_shares
  add constraint account_shares_role_check check (role in ('viewer','editor','admin'));

-- Helper that returns true if the current user owns or has any access to the
-- owner's data (admin > editor > viewer).
create or replace function public.has_role_on(p_owner uuid, p_min_role text default 'viewer')
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() = p_owner then true
    when p_min_role = 'viewer' then exists (
      select 1 from public.account_shares
      where owner_user_id = p_owner and member_user_id = auth.uid()
    )
    when p_min_role = 'editor' then exists (
      select 1 from public.account_shares
      where owner_user_id = p_owner and member_user_id = auth.uid() and role in ('editor','admin')
    )
    when p_min_role = 'admin' then exists (
      select 1 from public.account_shares
      where owner_user_id = p_owner and member_user_id = auth.uid() and role = 'admin'
    )
    else false
  end;
$$;

-- ─── 3. inspection_activity (audit log) ────────────────────────────────────
create table if not exists public.inspection_activity (
  id            bigserial primary key,
  inspection_id uuid not null,
  owner_user_id uuid not null,
  actor_user_id uuid,
  actor_email   text,
  action        text not null,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists inspection_activity_idx on public.inspection_activity (inspection_id, created_at desc);
alter table public.inspection_activity enable row level security;

drop policy if exists "activity_select_owner"  on public.inspection_activity;
drop policy if exists "activity_select_shared" on public.inspection_activity;
create policy "activity_select_owner"  on public.inspection_activity
  for select using (auth.uid() = owner_user_id);
create policy "activity_select_shared" on public.inspection_activity
  for select using (public.is_shared_with(owner_user_id));

-- Auto-log inserts / updates / deletes / stage changes.
create or replace function public.inspection_log_change() returns trigger as $$
declare
  v_email text;
  v_action text;
  v_details jsonb := '{}'::jsonb;
begin
  select email into v_email from auth.users where id = auth.uid();
  if tg_op = 'INSERT' then
    v_action := 'created';
  elsif tg_op = 'DELETE' then
    v_action := 'deleted';
  else
    if old.pipeline_stage is distinct from new.pipeline_stage then
      v_action := 'stage_changed';
      v_details := jsonb_build_object('from', old.pipeline_stage, 'to', new.pipeline_stage);
    elsif old.scheduled_at is distinct from new.scheduled_at then
      v_action := 'rescheduled';
      v_details := jsonb_build_object('from', old.scheduled_at, 'to', new.scheduled_at);
    else
      v_action := 'edited';
    end if;
  end if;

  insert into public.inspection_activity
    (inspection_id, owner_user_id, actor_user_id, actor_email, action, details)
  values
    (coalesce(new.id, old.id),
     coalesce(new.user_id, old.user_id),
     auth.uid(), v_email, v_action, v_details);

  return coalesce(new, old);
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists inspections_audit on public.inspections;
create trigger inspections_audit
  after insert or update or delete on public.inspections
  for each row execute function public.inspection_log_change();

-- ─── 4. tracking_events (PDF / quote views, email opens) ───────────────────
create table if not exists public.tracking_events (
  id            bigserial primary key,
  inspection_id uuid not null,
  owner_user_id uuid not null,
  kind          text not null check (kind in ('pdf_view','quote_view','email_open','quote_accepted')),
  ip            text,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index if not exists tracking_events_idx on public.tracking_events (inspection_id, created_at desc);
alter table public.tracking_events enable row level security;

drop policy if exists "tracking_select_owner"  on public.tracking_events;
drop policy if exists "tracking_select_shared" on public.tracking_events;
create policy "tracking_select_owner"  on public.tracking_events
  for select using (auth.uid() = owner_user_id);
create policy "tracking_select_shared" on public.tracking_events
  for select using (public.is_shared_with(owner_user_id));

-- Public RPC (anon-callable) so the public quote / pdf pages can log views
-- without exposing the table for writes.
create or replace function public.log_tracking_event(
  p_inspection_id uuid,
  p_kind text,
  p_ip text default null,
  p_ua  text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if p_kind not in ('pdf_view','quote_view','email_open','quote_accepted') then
    return;
  end if;
  select user_id into v_owner from public.inspections where id = p_inspection_id;
  if v_owner is null then return; end if;
  insert into public.tracking_events (inspection_id, owner_user_id, kind, ip, user_agent)
  values (p_inspection_id, v_owner, p_kind, p_ip, p_ua);
end $$;

revoke all on function public.log_tracking_event(uuid,text,text,text) from public;
grant execute on function public.log_tracking_event(uuid,text,text,text) to anon, authenticated;

-- ─── 5. public_quote_tokens (signed accept links) ──────────────────────────
create table if not exists public.public_quote_tokens (
  token         uuid primary key default gen_random_uuid(),
  inspection_id uuid not null,
  owner_user_id uuid not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz,
  accepted_at   timestamptz,
  accepted_name text,
  accepted_ip   text
);
create index if not exists public_quote_tokens_inspection_idx on public.public_quote_tokens (inspection_id);
alter table public.public_quote_tokens enable row level security;

drop policy if exists "tokens_select_owner" on public.public_quote_tokens;
drop policy if exists "tokens_insert_owner" on public.public_quote_tokens;
drop policy if exists "tokens_delete_owner" on public.public_quote_tokens;
create policy "tokens_select_owner" on public.public_quote_tokens
  for select using (auth.uid() = owner_user_id or public.is_shared_with(owner_user_id));
create policy "tokens_insert_owner" on public.public_quote_tokens
  for insert with check (auth.uid() = owner_user_id or public.is_shared_with(owner_user_id));
create policy "tokens_delete_owner" on public.public_quote_tokens
  for delete using (auth.uid() = owner_user_id);

-- Anon-callable RPC: resolve a token to a minimal quote payload.
create or replace function public.get_public_quote(p_token uuid)
returns table (
  inspection_id uuid,
  customer_name text,
  address       text,
  quote_items   jsonb,
  quote_total   numeric,
  currency      text,
  company       jsonb,
  accepted_at   timestamptz,
  accepted_name text
)
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_insp uuid;
  v_data jsonb;
  v_company jsonb;
  v_accepted_at timestamptz;
  v_accepted_name text;
begin
  select t.owner_user_id, t.inspection_id, t.accepted_at, t.accepted_name
    into v_owner, v_insp, v_accepted_at, v_accepted_name
  from public.public_quote_tokens t
  where t.token = p_token
    and (t.expires_at is null or t.expires_at > now());
  if v_insp is null then return; end if;

  select data into v_data from public.inspections where id = v_insp;
  select data into v_company from public.company_profiles where user_id = v_owner;

  return query select
    v_insp,
    v_data->>'customerName',
    v_data->>'address',
    coalesce(v_data->'quoteItems','[]'::jsonb),
    (select coalesce(sum(coalesce((it->>'qty')::numeric,0)*coalesce((it->>'unitPrice')::numeric,0)),0)
     from jsonb_array_elements(coalesce(v_data->'quoteItems','[]'::jsonb)) it),
    coalesce(v_data->>'quoteCurrency','EUR'),
    coalesce(v_company,'{}'::jsonb),
    v_accepted_at,
    v_accepted_name;
end $$;

revoke all on function public.get_public_quote(uuid) from public;
grant execute on function public.get_public_quote(uuid) to anon, authenticated;

-- Anon-callable RPC: mark a quote accepted.
create or replace function public.accept_public_quote(
  p_token uuid, p_name text, p_ip text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_insp uuid; v_owner uuid;
begin
  if coalesce(trim(p_name),'') = '' then return false; end if;
  update public.public_quote_tokens
     set accepted_at = now(), accepted_name = p_name, accepted_ip = p_ip
   where token = p_token
     and accepted_at is null
     and (expires_at is null or expires_at > now())
   returning inspection_id, owner_user_id into v_insp, v_owner;
  if v_insp is null then return false; end if;

  -- Bump pipeline stage to accepted.
  update public.inspections
     set data = jsonb_set(data,'{pipelineStage}', to_jsonb('accepted'::text), true),
         pipeline_stage = 'accepted'
   where id = v_insp;

  insert into public.tracking_events (inspection_id, owner_user_id, kind, ip)
  values (v_insp, v_owner, 'quote_accepted', p_ip);

  insert into public.inspection_activity (inspection_id, owner_user_id, actor_email, action, details)
  values (v_insp, v_owner, 'public', 'quote_accepted', jsonb_build_object('name', p_name));

  return true;
end $$;

revoke all on function public.accept_public_quote(uuid,text,text) from public;
grant execute on function public.accept_public_quote(uuid,text,text) to anon, authenticated;

-- ─── 6. warranty_reminders ─────────────────────────────────────────────────
create table if not exists public.warranty_reminders (
  id            bigserial primary key,
  inspection_id uuid not null,
  owner_user_id uuid not null,
  due_on        date not null,
  reason        text not null default '12_month_check',
  dismissed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists warranty_reminders_idx on public.warranty_reminders (owner_user_id, due_on);
alter table public.warranty_reminders enable row level security;

drop policy if exists "warranty_select_owner"  on public.warranty_reminders;
drop policy if exists "warranty_select_shared" on public.warranty_reminders;
drop policy if exists "warranty_update_owner"  on public.warranty_reminders;
drop policy if exists "warranty_insert_owner"  on public.warranty_reminders;
create policy "warranty_select_owner"  on public.warranty_reminders
  for select using (auth.uid() = owner_user_id);
create policy "warranty_select_shared" on public.warranty_reminders
  for select using (public.is_shared_with(owner_user_id));
create policy "warranty_update_owner"  on public.warranty_reminders
  for update using (auth.uid() = owner_user_id or public.is_shared_with(owner_user_id))
  with check  (auth.uid() = owner_user_id or public.is_shared_with(owner_user_id));
create policy "warranty_insert_owner"  on public.warranty_reminders
  for insert with check (auth.uid() = owner_user_id or public.is_shared_with(owner_user_id));

-- Auto-create a 12-month warranty reminder when an inspection is marked
-- completed.
create or replace function public.inspections_create_warranty() returns trigger as $$
begin
  if new.completed_at is not null
     and (old.completed_at is null or old.completed_at is distinct from new.completed_at) then
    insert into public.warranty_reminders (inspection_id, owner_user_id, due_on, reason)
    values (new.id, new.user_id, (new.completed_at + interval '12 months')::date, '12_month_check')
    on conflict do nothing;
  end if;
  return new;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists inspections_create_warranty on public.inspections;
create trigger inspections_create_warranty
  after update on public.inspections
  for each row execute function public.inspections_create_warranty();

-- ─── 7. list_my_shares — include role admin (returns text already) ────────
-- No change needed; existing function returns whatever role text is stored.

-- Done. You should see "Success. No rows returned."
