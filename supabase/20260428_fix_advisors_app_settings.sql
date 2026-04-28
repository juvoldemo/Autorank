-- Run this in Supabase SQL Editor to repair existing projects.

alter table public.advisors add column if not exists advisor_code text;
alter table public.advisors add column if not exists advisor_name text;
alter table public.advisors add column if not exists team_name text;
alter table public.advisors add column if not exists normalized_name text;
alter table public.advisors add column if not exists revenue numeric default 0;
alter table public.advisors add column if not exists avatar_url text;
alter table public.advisors add column if not exists avatar_path text;
alter table public.advisors add column if not exists created_at timestamptz default now();
alter table public.advisors add column if not exists updated_at timestamptz default now();

update public.advisors
set
  advisor_name = nullif(coalesce(advisor_name, name), ''),
  team_name = nullif(coalesce(team_name, team), ''),
  normalized_name = coalesce(
    normalized_name,
    lower(regexp_replace(unaccent(coalesce(advisor_name, name, '')), '[^a-zA-Z0-9]+', ' ', 'g'))
  )
where advisor_name is null or normalized_name is null;

create index if not exists advisors_normalized_name_idx on public.advisors (normalized_name);
create unique index if not exists advisors_advisor_code_uidx
on public.advisors (advisor_code)
where advisor_code is not null and advisor_code <> '';

create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

alter table public.app_settings add column if not exists value text;
alter table public.app_settings add column if not exists updated_at timestamptz default now();

insert into public.app_settings (key, value, updated_at)
select 'google_sheet_monthly_url', value, now() from public.app_settings where key = 'top_month_sheet_url'
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into public.app_settings (key, value, updated_at)
select 'google_sheet_daily_url', value, now() from public.app_settings where key = 'top_day_sheet_url'
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into public.app_settings (key, value, updated_at)
select 'google_drive_phibaohiem_folder_url', value, now() from public.app_settings where key = 'phibaohiem_drive_folder_url'
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into public.app_settings (key, value, updated_at)
select 'google_sheet_tbtn_url', value, now() from public.app_settings where key = 'tbtn_sheet_url'
on conflict (key) do update set value = excluded.value, updated_at = now();

alter table public.app_settings enable row level security;

drop policy if exists "Public read app settings" on public.app_settings;
create policy "Public read app settings" on public.app_settings for select using (true);

drop policy if exists "Public write app settings" on public.app_settings;
create policy "Public write app settings" on public.app_settings for all using (true) with check (true);
