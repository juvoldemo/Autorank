-- Autorank Supabase schema
-- Run this in Supabase SQL Editor if these tables do not exist yet.

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

alter table public.advisors add column if not exists name text not null default '';
alter table public.advisors add column if not exists team text not null default '';
alter table public.advisors add column if not exists revenue bigint not null default 0;
alter table public.advisors add column if not exists note text not null default '';
alter table public.advisors add column if not exists avatar text not null default '';
alter table public.advisors add column if not exists active_status boolean not null default true;
alter table public.advisors add column if not exists sort_order integer not null default 0;
alter table public.advisors add column if not exists updated_at timestamptz not null default now();

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
end $$;

alter table public.advisors enable row level security;
alter table public.competitions enable row level security;
alter table public.campaign_rankings enable row level security;
alter table public.page_banners enable row level security;

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
