-- Run this in Supabase SQL Editor if ranking sync reports missing avatar_url/avatar_path/normalized_name.

alter table public.daily_rankings
  add column if not exists avatar_url text,
  add column if not exists avatar_path text,
  add column if not exists normalized_name text;

alter table public.monthly_rankings
  add column if not exists report_date date default current_date,
  add column if not exists avatar_url text,
  add column if not exists avatar_path text,
  add column if not exists normalized_name text;

update public.daily_rankings
set normalized_name = lower(regexp_replace(unaccent(coalesce(advisor_name, '')), '[^a-zA-Z0-9]+', ' ', 'g'))
where normalized_name is null;

update public.monthly_rankings
set normalized_name = lower(regexp_replace(unaccent(coalesce(advisor_name, '')), '[^a-zA-Z0-9]+', ' ', 'g'))
where normalized_name is null;

with duplicated_daily as (
  select
    ctid,
    row_number() over (
      partition by report_date, rank
      order by created_at desc nulls last, id desc
    ) as row_number
  from public.daily_rankings
)
delete from public.daily_rankings d
using duplicated_daily x
where d.ctid = x.ctid
  and x.row_number > 1;

with duplicated_monthly as (
  select
    ctid,
    row_number() over (
      partition by report_year, report_month, rank
      order by created_at desc nulls last, id desc
    ) as row_number
  from public.monthly_rankings
)
delete from public.monthly_rankings m
using duplicated_monthly x
where m.ctid = x.ctid
  and x.row_number > 1;

create unique index if not exists daily_rankings_report_rank_uidx
on public.daily_rankings (report_date, rank);

create unique index if not exists monthly_rankings_period_rank_uidx
on public.monthly_rankings (report_year, report_month, rank);
