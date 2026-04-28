-- Run this in Supabase SQL Editor to store CTTD leaderboard rows imported from Google Sheet.

create table if not exists public.competition_leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  competition_id text,
  sheet_source text,
  rank integer,
  advisor_name text not null,
  group_name text,
  customer_name text,
  collection_date date,
  total_pdt_tvv numeric not null default 0,
  reward_achieved_t4 numeric not null default 0,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.competitions
  add column if not exists leaderboard_sheet_url text not null default '',
  add column if not exists leaderboard_sheet_name text not null default 'CTTD_GIO_TO';

alter table public.competition_leaderboard_entries
  add column if not exists competition_id text,
  add column if not exists sheet_source text,
  add column if not exists rank integer,
  add column if not exists advisor_name text not null default '',
  add column if not exists group_name text,
  add column if not exists customer_name text,
  add column if not exists collection_date date,
  add column if not exists total_pdt_tvv numeric not null default 0,
  add column if not exists reward_achieved_t4 numeric not null default 0,
  add column if not exists raw_data jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

drop index if exists public.competition_leaderboard_entries_unique_row_uidx;
drop index if exists public.competition_leaderboard_entries_competition_idx;

alter table public.competition_leaderboard_entries
  alter column competition_id type text using competition_id::text;

create unique index if not exists competition_leaderboard_entries_unique_row_uidx
on public.competition_leaderboard_entries (
  competition_id,
  advisor_name,
  customer_name,
  collection_date,
  total_pdt_tvv
);

create index if not exists competition_leaderboard_entries_competition_idx
on public.competition_leaderboard_entries (competition_id, total_pdt_tvv desc, rank asc);

drop trigger if exists competition_leaderboard_entries_set_updated_at on public.competition_leaderboard_entries;
create trigger competition_leaderboard_entries_set_updated_at
before update on public.competition_leaderboard_entries
for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'competition_leaderboard_entries'
  ) then
    alter publication supabase_realtime add table public.competition_leaderboard_entries;
  end if;
end $$;

alter table public.competition_leaderboard_entries enable row level security;

drop policy if exists "Public read competition leaderboard entries" on public.competition_leaderboard_entries;
create policy "Public read competition leaderboard entries"
on public.competition_leaderboard_entries for select using (true);

drop policy if exists "Public write competition leaderboard entries" on public.competition_leaderboard_entries;
create policy "Public write competition leaderboard entries"
on public.competition_leaderboard_entries for all using (true) with check (true);
