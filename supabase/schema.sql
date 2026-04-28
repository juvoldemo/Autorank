-- Autorank Supabase schema
-- Run this in Supabase SQL Editor if these tables do not exist yet.

create extension if not exists unaccent;

create table if not exists public.advisors (
  id text primary key,
  name text not null default '',
  team text not null default '',
  initials text not null default 'TV',
  revenue bigint not null default 0,
  note text not null default '',
  avatar text not null default '',
  active_status boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.advisors alter column id set default gen_random_uuid()::text;
alter table public.advisors add column if not exists name text not null default '';
alter table public.advisors add column if not exists team text not null default '';
alter table public.advisors add column if not exists revenue bigint not null default 0;
alter table public.advisors add column if not exists note text not null default '';
alter table public.advisors add column if not exists avatar text not null default '';
alter table public.advisors add column if not exists active_status boolean not null default true;
alter table public.advisors add column if not exists sort_order integer not null default 0;
alter table public.advisors add column if not exists advisor_code text;
alter table public.advisors add column if not exists advisor_name text;
alter table public.advisors add column if not exists team_name text;
alter table public.advisors add column if not exists department_name text;
alter table public.advisors add column if not exists normalized_name text;
alter table public.advisors add column if not exists avatar_url text;
alter table public.advisors add column if not exists created_at timestamptz not null default now();
alter table public.advisors add column if not exists updated_at timestamptz not null default now();

update public.advisors
set
  advisor_name = nullif(coalesce(advisor_name, name), ''),
  team_name = nullif(coalesce(team_name, team), ''),
  avatar_url = nullif(coalesce(avatar_url, avatar), ''),
  normalized_name = coalesce(
    normalized_name,
    lower(regexp_replace(unaccent(coalesce(advisor_name, name, '')), '[^a-zA-Z0-9]+', ' ', 'g'))
  )
where advisor_name is null or normalized_name is null;

create unique index if not exists advisors_advisor_code_uidx
on public.advisors (advisor_code)
where advisor_code is not null and advisor_code <> '';

create index if not exists advisors_normalized_name_idx
on public.advisors (normalized_name);

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_rankings (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  rank integer not null,
  advisor_name text not null,
  normalized_name text not null,
  advisor_code text,
  team_name text,
  department_name text,
  revenue numeric not null default 0,
  avatar_url text,
  source_file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists daily_rankings_report_rank_uidx
on public.daily_rankings (report_date, rank);

create index if not exists daily_rankings_report_date_idx
on public.daily_rankings (report_date desc);

create table if not exists public.monthly_rankings (
  id uuid primary key default gen_random_uuid(),
  report_month integer not null check (report_month between 1 and 12),
  report_year integer not null,
  rank integer not null,
  advisor_name text not null,
  normalized_name text not null,
  advisor_code text,
  team_name text,
  department_name text,
  revenue numeric not null default 0,
  avatar_url text,
  source_file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists monthly_rankings_period_rank_uidx
on public.monthly_rankings (report_year, report_month, rank);

create index if not exists monthly_rankings_period_idx
on public.monthly_rankings (report_year desc, report_month desc);

create table if not exists public.team_overview (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  team_name text not null,
  normalized_team_name text not null,
  total_revenue numeric not null default 0,
  active_advisors integer not null default 0,
  contract_count integer not null default 0,
  percent_of_company numeric not null default 0,
  rank integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists team_overview_report_team_uidx
on public.team_overview (report_date, normalized_team_name);

create index if not exists team_overview_report_date_idx
on public.team_overview (report_date desc);

create table if not exists public.import_logs (
  id uuid primary key default gen_random_uuid(),
  import_type text not null,
  source_name text,
  status text not null default 'success',
  message text,
  total_rows integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.competitions (
  id text primary key,
  title text not null default '',
  poster text not null default '',
  start_date date,
  end_date date,
  summary text not null default '',
  details text not null default '',
  reward text not null default '',
  target text not null default '',
  rules text not null default '',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.competitions add column if not exists title text not null default '';
alter table public.competitions add column if not exists poster text not null default '';
alter table public.competitions add column if not exists start_date date;
alter table public.competitions add column if not exists end_date date;
alter table public.competitions add column if not exists summary text not null default '';
alter table public.competitions add column if not exists details text not null default '';
alter table public.competitions add column if not exists reward text not null default '';
alter table public.competitions add column if not exists target text not null default '';
alter table public.competitions add column if not exists rules text not null default '';
alter table public.competitions add column if not exists published boolean not null default true;
alter table public.competitions add column if not exists created_at timestamptz not null default now();
alter table public.competitions add column if not exists updated_at timestamptz not null default now();

create table if not exists public.campaign_rankings (
  id text primary key,
  campaign_id text not null,
  name text not null default '',
  team text not null default '',
  initials text not null default 'TV',
  revenue bigint not null default 0,
  avatar text not null default '',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.campaigns') is not null then
    insert into public.competitions (
      id,
      title,
      poster,
      start_date,
      end_date,
      summary,
      details,
      published,
      created_at,
      updated_at
    )
    select
      id,
      title,
      coalesce(image, ''),
      start_date,
      end_date,
      coalesce(details, ''),
      coalesce(details, ''),
      coalesce(status, 'active') <> 'ended',
      coalesce(updated_at, now()),
      coalesce(updated_at, now())
    from public.campaigns
    on conflict (id) do nothing;
  end if;
end $$;

create table if not exists public.page_banners (
  page_id text primary key,
  image text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.advisor_profiles (
  id uuid primary key default gen_random_uuid(),
  advisor_code text unique,
  advisor_name text not null,
  normalized_name text not null,
  team_name text,
  avatar_url text,
  avatar_path text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists advisor_profiles_normalized_name_idx
on public.advisor_profiles (normalized_name);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'autorank-assets',
  'autorank-assets',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'advisor-avatars',
  'advisor-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists advisors_set_updated_at on public.advisors;
create trigger advisors_set_updated_at
before update on public.advisors
for each row execute function public.set_updated_at();

drop trigger if exists competitions_set_updated_at on public.competitions;
create trigger competitions_set_updated_at
before update on public.competitions
for each row execute function public.set_updated_at();

drop trigger if exists campaign_rankings_set_updated_at on public.campaign_rankings;
create trigger campaign_rankings_set_updated_at
before update on public.campaign_rankings
for each row execute function public.set_updated_at();

drop trigger if exists page_banners_set_updated_at on public.page_banners;
create trigger page_banners_set_updated_at
before update on public.page_banners
for each row execute function public.set_updated_at();

drop trigger if exists advisor_profiles_set_updated_at on public.advisor_profiles;
create trigger advisor_profiles_set_updated_at
before update on public.advisor_profiles
for each row execute function public.set_updated_at();

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

drop trigger if exists daily_rankings_set_updated_at on public.daily_rankings;
create trigger daily_rankings_set_updated_at
before update on public.daily_rankings
for each row execute function public.set_updated_at();

drop trigger if exists monthly_rankings_set_updated_at on public.monthly_rankings;
create trigger monthly_rankings_set_updated_at
before update on public.monthly_rankings
for each row execute function public.set_updated_at();

drop trigger if exists team_overview_set_updated_at on public.team_overview;
create trigger team_overview_set_updated_at
before update on public.team_overview
for each row execute function public.set_updated_at();

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'campaign_rankings'
      and con.contype = 'f'
  loop
    execute format('alter table public.campaign_rankings drop constraint if exists %I', constraint_name);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'advisors'
  ) then
    alter publication supabase_realtime add table public.advisors;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'competitions'
  ) then
    alter publication supabase_realtime add table public.competitions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'campaign_rankings'
  ) then
    alter publication supabase_realtime add table public.campaign_rankings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'page_banners'
  ) then
    alter publication supabase_realtime add table public.page_banners;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'advisor_profiles'
  ) then
    alter publication supabase_realtime add table public.advisor_profiles;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_rankings'
  ) then
    alter publication supabase_realtime add table public.daily_rankings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'monthly_rankings'
  ) then
    alter publication supabase_realtime add table public.monthly_rankings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_overview'
  ) then
    alter publication supabase_realtime add table public.team_overview;
  end if;
end $$;

alter table public.advisors enable row level security;
alter table public.competitions enable row level security;
alter table public.campaign_rankings enable row level security;
alter table public.page_banners enable row level security;
alter table public.advisor_profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.daily_rankings enable row level security;
alter table public.monthly_rankings enable row level security;
alter table public.team_overview enable row level security;
alter table public.import_logs enable row level security;

drop policy if exists "Public read advisors" on public.advisors;
create policy "Public read advisors" on public.advisors for select using (true);
drop policy if exists "Public write advisors" on public.advisors;
create policy "Public write advisors" on public.advisors for all using (true) with check (true);

drop policy if exists "Public read competitions" on public.competitions;
create policy "Public read competitions" on public.competitions for select using (true);
drop policy if exists "Public write competitions" on public.competitions;
create policy "Public write competitions" on public.competitions for all using (true) with check (true);

drop policy if exists "Public read campaign rankings" on public.campaign_rankings;
create policy "Public read campaign rankings" on public.campaign_rankings for select using (true);
drop policy if exists "Public write campaign rankings" on public.campaign_rankings;
create policy "Public write campaign rankings" on public.campaign_rankings for all using (true) with check (true);

drop policy if exists "Public read page banners" on public.page_banners;
create policy "Public read page banners" on public.page_banners for select using (true);
drop policy if exists "Public write page banners" on public.page_banners;
create policy "Public write page banners" on public.page_banners for all using (true) with check (true);

drop policy if exists "Public read advisor profiles" on public.advisor_profiles;
create policy "Public read advisor profiles" on public.advisor_profiles for select using (true);
drop policy if exists "Authenticated write advisor profiles" on public.advisor_profiles;
create policy "Authenticated write advisor profiles"
on public.advisor_profiles for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');
drop policy if exists "Public write advisor profiles" on public.advisor_profiles;
create policy "Public write advisor profiles"
on public.advisor_profiles for all
using (true)
with check (true);

drop policy if exists "Public read app settings" on public.app_settings;
create policy "Public read app settings" on public.app_settings for select using (true);
drop policy if exists "Public write app settings" on public.app_settings;
create policy "Public write app settings" on public.app_settings for all using (true) with check (true);

drop policy if exists "Public read daily rankings" on public.daily_rankings;
create policy "Public read daily rankings" on public.daily_rankings for select using (true);
drop policy if exists "Public write daily rankings" on public.daily_rankings;
create policy "Public write daily rankings" on public.daily_rankings for all using (true) with check (true);

drop policy if exists "Public read monthly rankings" on public.monthly_rankings;
create policy "Public read monthly rankings" on public.monthly_rankings for select using (true);
drop policy if exists "Public write monthly rankings" on public.monthly_rankings;
create policy "Public write monthly rankings" on public.monthly_rankings for all using (true) with check (true);

drop policy if exists "Public read team overview" on public.team_overview;
create policy "Public read team overview" on public.team_overview for select using (true);
drop policy if exists "Public write team overview" on public.team_overview;
create policy "Public write team overview" on public.team_overview for all using (true) with check (true);

drop policy if exists "Public read import logs" on public.import_logs;
create policy "Public read import logs" on public.import_logs for select using (true);
drop policy if exists "Public write import logs" on public.import_logs;
create policy "Public write import logs" on public.import_logs for all using (true) with check (true);

drop policy if exists "Public read autorank assets" on storage.objects;
create policy "Public read autorank assets"
on storage.objects for select
using (bucket_id = 'autorank-assets');

drop policy if exists "Public upload autorank assets" on storage.objects;
create policy "Public upload autorank assets"
on storage.objects for insert
with check (bucket_id = 'autorank-assets');

drop policy if exists "Public update autorank assets" on storage.objects;
create policy "Public update autorank assets"
on storage.objects for update
using (bucket_id = 'autorank-assets')
with check (bucket_id = 'autorank-assets');

drop policy if exists "Public delete autorank assets" on storage.objects;
create policy "Public delete autorank assets"
on storage.objects for delete
using (bucket_id = 'autorank-assets');

drop policy if exists "Public read advisor avatars" on storage.objects;
create policy "Public read advisor avatars"
on storage.objects for select
using (bucket_id = 'advisor-avatars');

drop policy if exists "Authenticated upload advisor avatars" on storage.objects;
create policy "Authenticated upload advisor avatars"
on storage.objects for insert
with check (bucket_id = 'advisor-avatars' and auth.role() = 'authenticated');

drop policy if exists "Authenticated update advisor avatars" on storage.objects;
create policy "Authenticated update advisor avatars"
on storage.objects for update
using (bucket_id = 'advisor-avatars' and auth.role() = 'authenticated')
with check (bucket_id = 'advisor-avatars' and auth.role() = 'authenticated');

drop policy if exists "Authenticated delete advisor avatars" on storage.objects;
create policy "Authenticated delete advisor avatars"
on storage.objects for delete
using (bucket_id = 'advisor-avatars' and auth.role() = 'authenticated');

drop policy if exists "Public upload advisor avatars" on storage.objects;
create policy "Public upload advisor avatars"
on storage.objects for insert
with check (bucket_id = 'advisor-avatars');

drop policy if exists "Public update advisor avatars" on storage.objects;
create policy "Public update advisor avatars"
on storage.objects for update
using (bucket_id = 'advisor-avatars')
with check (bucket_id = 'advisor-avatars');

drop policy if exists "Public delete advisor avatars" on storage.objects;
create policy "Public delete advisor avatars"
on storage.objects for delete
using (bucket_id = 'advisor-avatars');

drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "Public upload avatars" on storage.objects;
create policy "Public upload avatars"
on storage.objects for insert
with check (bucket_id = 'avatars');

drop policy if exists "Public update avatars" on storage.objects;
create policy "Public update avatars"
on storage.objects for update
using (bucket_id = 'avatars')
with check (bucket_id = 'avatars');

drop policy if exists "Public delete avatars" on storage.objects;
create policy "Public delete avatars"
on storage.objects for delete
using (bucket_id = 'avatars');
