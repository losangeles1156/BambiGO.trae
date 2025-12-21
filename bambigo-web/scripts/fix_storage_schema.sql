-- 1. Create saved_locations table
create table if not exists saved_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  node_id text references nodes(id) on delete set null,
  facility_id text references facilities(id) on delete set null,
  title text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_saved_locations_user on saved_locations(user_id);
create index if not exists idx_saved_locations_created on saved_locations(created_at desc);

-- 2. Enable RLS
alter table saved_locations enable row level security;
alter table users enable row level security;
alter table trip_subscriptions enable row level security;
alter table nudge_logs enable row level security;

-- 3. Create User Policies (Idempotent)
do $$
begin
  -- saved_locations
  if not exists (select 1 from pg_policies where tablename='saved_locations' and policyname='saved_locations_own_select') then
    create policy saved_locations_own_select on saved_locations for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='saved_locations' and policyname='saved_locations_own_insert') then
    create policy saved_locations_own_insert on saved_locations for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='saved_locations' and policyname='saved_locations_own_update') then
    create policy saved_locations_own_update on saved_locations for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='saved_locations' and policyname='saved_locations_own_delete') then
    create policy saved_locations_own_delete on saved_locations for delete using (auth.uid() = user_id);
  end if;

  -- trip_subscriptions
  if not exists (select 1 from pg_policies where tablename='trip_subscriptions' and policyname='trip_subscriptions_own_select') then
    create policy trip_subscriptions_own_select on trip_subscriptions for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='trip_subscriptions' and policyname='trip_subscriptions_own_insert') then
    create policy trip_subscriptions_own_insert on trip_subscriptions for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='trip_subscriptions' and policyname='trip_subscriptions_own_update') then
    create policy trip_subscriptions_own_update on trip_subscriptions for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='trip_subscriptions' and policyname='trip_subscriptions_own_delete') then
    create policy trip_subscriptions_own_delete on trip_subscriptions for delete using (auth.uid() = user_id);
  end if;

  -- nudge_logs
  if not exists (select 1 from pg_policies where tablename='nudge_logs' and policyname='nudge_logs_own_select') then
    create policy nudge_logs_own_select on nudge_logs for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='nudge_logs' and policyname='nudge_logs_own_insert') then
    create policy nudge_logs_own_insert on nudge_logs for insert with check (auth.uid() = user_id);
  end if;

  -- users
  if not exists (select 1 from pg_policies where tablename='users' and policyname='users_own_select') then
    create policy users_own_select on users for select using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename='users' and policyname='users_own_insert') then
    create policy users_own_insert on users for insert with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename='users' and policyname='users_own_update') then
    create policy users_own_update on users for update using (auth.uid() = id);
  end if;
end $$;
