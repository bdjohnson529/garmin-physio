-- Phase 1: profiles. One row per signed-in user, created by a trigger on sign-up.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'Europe/London',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon;

create policy "profiles select own" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "profiles insert own" on public.profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "profiles update own" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "profiles delete own" on public.profiles
  for delete to authenticated using (user_id = (select auth.uid()));

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
