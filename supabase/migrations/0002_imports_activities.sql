-- Phase 1: the two tables the Activities screen and the isolation test need.
-- Phase 2 adds sports, body_parts, user_body_parts, notes and shares, plus seeds.

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  filename text,
  rows_read integer not null default 0,
  rows_new integer not null default 0,
  rows_updated integer not null default 0,
  rows_skipped integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index imports_user_created_idx on public.imports (user_id, created_at desc);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null default 'garmin_csv' check (source in ('garmin_csv')),
  external_key text not null,
  started_at timestamptz not null,
  local_date date not null,
  duration_s integer,
  distance_m numeric,
  calories integer,
  title text,
  type_raw text not null,
  sport_key text not null,
  raw jsonb not null default '{}'::jsonb,
  import_id uuid references public.imports (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, external_key)
);

create index activities_user_date_idx on public.activities (user_id, local_date desc);

alter table public.imports enable row level security;
alter table public.activities enable row level security;
revoke all on public.imports, public.activities from anon;

create policy "imports select own" on public.imports
  for select to authenticated using (user_id = (select auth.uid()));
create policy "imports insert own" on public.imports
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "imports update own" on public.imports
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "imports delete own" on public.imports
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "activities select own" on public.activities
  for select to authenticated using (user_id = (select auth.uid()));
create policy "activities insert own" on public.activities
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "activities update own" on public.activities
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "activities delete own" on public.activities
  for delete to authenticated using (user_id = (select auth.uid()));
