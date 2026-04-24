-- Autorank Supabase schema
-- Run this in Supabase SQL Editor if these tables do not exist yet.

create table if not exists public.advisors (
  id text primary key,
  name text not null default '',
  team text not null default '',
  initials text not null default 'TV',
  revenue bigint not null default 0,
  avatar text not null default '',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id text primary key,
  title text not null default '',
  image text not null default '',
  start_date date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'upcoming', 'ended')),
  details text not null default '',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_rankings (
  id text primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  name text not null default '',
  team text not null default '',
  initials text not null default 'TV',
  revenue bigint not null default 0,
  avatar text not null default '',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.page_banners (
  page_id text primary key,
  image text not null default '',
  updated_at timestamptz not null default now()
);

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

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

drop trigger if exists campaign_rankings_set_updated_at on public.campaign_rankings;
create trigger campaign_rankings_set_updated_at
before update on public.campaign_rankings
for each row execute function public.set_updated_at();

drop trigger if exists page_banners_set_updated_at on public.page_banners;
create trigger page_banners_set_updated_at
before update on public.page_banners
for each row execute function public.set_updated_at();

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
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'campaigns'
  ) then
    alter publication supabase_realtime add table public.campaigns;
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
end $$;

alter table public.advisors enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_rankings enable row level security;
alter table public.page_banners enable row level security;

drop policy if exists "Public read advisors" on public.advisors;
create policy "Public read advisors" on public.advisors for select using (true);
drop policy if exists "Public write advisors" on public.advisors;
create policy "Public write advisors" on public.advisors for all using (true) with check (true);

drop policy if exists "Public read campaigns" on public.campaigns;
create policy "Public read campaigns" on public.campaigns for select using (true);
drop policy if exists "Public write campaigns" on public.campaigns;
create policy "Public write campaigns" on public.campaigns for all using (true) with check (true);

drop policy if exists "Public read campaign rankings" on public.campaign_rankings;
create policy "Public read campaign rankings" on public.campaign_rankings for select using (true);
drop policy if exists "Public write campaign rankings" on public.campaign_rankings;
create policy "Public write campaign rankings" on public.campaign_rankings for all using (true) with check (true);

drop policy if exists "Public read page banners" on public.page_banners;
create policy "Public read page banners" on public.page_banners for select using (true);
drop policy if exists "Public write page banners" on public.page_banners;
create policy "Public write page banners" on public.page_banners for all using (true) with check (true);
