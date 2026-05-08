-- Cheddar: initial schema.
-- Households (one per couple/family), profiles (one per auth user),
-- and household_state (one JSONB document per household holding the entire app state).
--
-- Run order matters: tables first (so cross-references resolve), then RLS,
-- then policies, then trigger.

drop table if exists public.household_state cascade;
drop table if exists public.profiles cascade;
drop table if exists public.households cascade;
drop function if exists public.handle_new_user() cascade;

create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'My household',
  created_by  uuid not null references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text,
  household_id        uuid references public.households(id) on delete set null,
  ui_prefs            jsonb not null default '{}'::jsonb,
  anthropic_api_key   text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.household_state (
  household_id  uuid primary key references public.households(id) on delete cascade,
  data          jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id) on delete set null
);

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.household_state enable row level security;

create policy "own profile read"   on public.profiles for select using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert with check (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid());

create policy "household members can read"
  on public.households for select
  using (
    id = (select household_id from public.profiles where id = auth.uid())
    or created_by = auth.uid()
  );

create policy "authed users can create households"
  on public.households for insert
  with check (created_by = auth.uid());

create policy "household members can update"
  on public.households for update
  using (id = (select household_id from public.profiles where id = auth.uid()));

create policy "household members can read state"
  on public.household_state for select
  using (household_id = (select household_id from public.profiles where id = auth.uid()));

create policy "household members can insert state"
  on public.household_state for insert
  with check (household_id = (select household_id from public.profiles where id = auth.uid()));

create policy "household members can update state"
  on public.household_state for update
  using (household_id = (select household_id from public.profiles where id = auth.uid()));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter publication supabase_realtime add table public.household_state;
