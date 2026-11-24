-- =============================================================================
--  TA BILL — Supabase schema v1
--  Apply once in the Supabase Dashboard -> SQL Editor (or `supabase db push`).
--  Safe to re-run: tables/policies/triggers are guarded.
--
--  Model:  auth.users (Google OAuth) -> public.profiles / tours / entries
--  Rules:  every row is owned by auth.uid(); RLS enforces it server-side.
--  Profile: the CBS/DMS/HRMS/ELEARNING logins live in profiles.data alongside
--          the rest of the profile and therefore sync across devices.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
--  Helpers
-- -----------------------------------------------------------------------------
create or replace function public.tabill_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
--  Tables
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,   -- UserProfile, incl. credentials
  updated_at timestamptz not null default now()
);

create table if not exists public.tours (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  id         text        not null,
  name       text        not null default 'Inspection Tour',
  start_date date,
  end_date   date,
  currency   text        not null default 'INR',
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.entries (
  user_id         uuid        not null references auth.users (id) on delete cascade,
  id              text        not null,
  tour_id         text,
  date            date        not null,
  branch          text        not null default '',
  dp_code         text        not null default '',
  inspection_type text        not null default 'RBIA',
  day_status      text        not null default 'Inspection'
                              check (day_status in ('Inspection', 'Leave', 'Holiday')),
  onward_journey  jsonb       not null default '[]'::jsonb,
  return_journey  jsonb       not null default '[]'::jsonb,
  other_expenses  jsonb       not null default '[]'::jsonb,
  last_saved_at   text,
  deleted_at      timestamptz,                            -- tombstone for deletes
  updated_at      timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, tour_id) references public.tours (user_id, id) on delete cascade
);

create index if not exists entries_user_date_idx
  on public.entries (user_id, date);
create index if not exists entries_user_updated_idx
  on public.entries (user_id, updated_at);
create index if not exists tours_user_idx
  on public.tours (user_id);

-- -----------------------------------------------------------------------------
--  updated_at triggers
-- -----------------------------------------------------------------------------
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.tabill_touch_updated_at();

drop trigger if exists tours_touch on public.tours;
create trigger tours_touch before update on public.tours
  for each row execute function public.tabill_touch_updated_at();

drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before update on public.entries
  for each row execute function public.tabill_touch_updated_at();

-- -----------------------------------------------------------------------------
--  Row Level Security — owner-only, no public access
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.tours    enable row level security;
alter table public.entries  enable row level security;

drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists tours_owner on public.tours;
create policy tours_owner on public.tours
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists entries_owner on public.entries;
create policy entries_owner on public.entries
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.profiles, public.tours, public.entries from anon;
grant select, insert, update, delete
  on public.profiles, public.tours, public.entries
  to authenticated;

-- -----------------------------------------------------------------------------
--  New-user bootstrap: create an empty profile from Google metadata
-- -----------------------------------------------------------------------------
create or replace function public.tabill_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, data)
  values (
    new.id,
    jsonb_build_object(
      'name',   coalesce(new.raw_user_meta_data ->> 'full_name',
                         new.raw_user_meta_data ->> 'name', ''),
      'email',  coalesce(new.email, ''),
      'avatar', new.raw_user_meta_data ->> 'avatar_url'
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists tabill_on_auth_user_created on auth.users;
create trigger tabill_on_auth_user_created
  after insert on auth.users
  for each row execute function public.tabill_handle_new_user();

-- -----------------------------------------------------------------------------
--  Optional email allowlist.
--  While public.allowed_emails is EMPTY, anyone who completes Google OAuth can
--  sign in. Insert your email(s) to lock the project down:
--
--     insert into public.allowed_emails (email) values ('you@gmail.com');
--
--  Also recommended: Authentication -> Sign In / Providers -> disable
--  "Allow new users to sign up" once your account exists.
-- -----------------------------------------------------------------------------
create table if not exists public.allowed_emails (
  email      text primary key,
  created_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;
revoke all on public.allowed_emails from anon, authenticated;

create or replace function public.tabill_enforce_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.allowed_emails)
     and not exists (
       select 1 from public.allowed_emails a
       where lower(a.email) = lower(coalesce(new.email, ''))
     ) then
    raise exception 'signup_not_allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists tabill_allowlist on auth.users;
create trigger tabill_allowlist
  before insert on auth.users
  for each row execute function public.tabill_enforce_allowlist();
