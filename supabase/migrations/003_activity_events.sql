create table activity_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  session_id text not null,
  page_path text,
  product_id uuid references products(id) on delete set null,
  product_name text,
  referrer text,
  user_agent text,
  device_type text,
  country text,
  created_at timestamptz default now()
);
create index activity_events_created_at_idx on activity_events(created_at desc);
create index activity_events_session_id_idx on activity_events(session_id);

-- RLS
alter table activity_events enable row level security;

-- Anon visitors can INSERT only
create policy "anon_insert_activity"
  on activity_events
  for insert
  to anon
  with check (true);

-- Authenticated admin can SELECT
create policy "auth_select_activity"
  on activity_events
  for select
  to authenticated
  using (true);
