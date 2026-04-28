-- Run this in Supabase SQL Editor if TBTN shows duplicate teams after repeated syncs.

create extension if not exists unaccent;

alter table public.team_overview
  add column if not exists normalized_team_name text not null default '',
  add column if not exists rank integer not null default 0;

update public.team_overview
set normalized_team_name = lower(regexp_replace(unaccent(coalesce(team_name, '')), '[^a-zA-Z0-9]+', '-', 'g'))
where normalized_team_name is null
   or normalized_team_name = '';

with duplicated_team_overview as (
  select
    ctid,
    row_number() over (
      partition by report_date, normalized_team_name
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as row_number
  from public.team_overview
)
delete from public.team_overview t
using duplicated_team_overview x
where t.ctid = x.ctid
  and x.row_number > 1;

create unique index if not exists team_overview_report_team_uidx
on public.team_overview (report_date, normalized_team_name);
