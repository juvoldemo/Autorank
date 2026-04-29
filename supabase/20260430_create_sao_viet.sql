create table if not exists public.sao_viet_settings (
  id uuid primary key default gen_random_uuid(),
  sheet_url text,
  sheet_name text default 'TongHop',
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.sao_viet_settings add column if not exists sheet_url text;
alter table public.sao_viet_settings add column if not exists sheet_name text default 'TongHop';
alter table public.sao_viet_settings add column if not exists last_synced_at timestamptz;
alter table public.sao_viet_settings add column if not exists created_at timestamptz default now();
alter table public.sao_viet_settings add column if not exists updated_at timestamptz default now();

create table if not exists public.sao_viet_members (
  id uuid primary key default gen_random_uuid(),
  stt int,
  advisor_name text not null,
  normalized_name text,
  group_name text,
  avatar_url text,
  total_revenue numeric default 0,
  gap_gold numeric default 0,
  gap_platinum numeric default 0,
  gap_diamond numeric default 0,
  current_tier text,
  progress_percent numeric default 0,
  next_tier text,
  synced_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.sao_viet_members add column if not exists stt int;
alter table public.sao_viet_members add column if not exists advisor_name text;
alter table public.sao_viet_members add column if not exists normalized_name text;
alter table public.sao_viet_members add column if not exists group_name text;
alter table public.sao_viet_members add column if not exists avatar_url text;
alter table public.sao_viet_members add column if not exists total_revenue numeric default 0;
alter table public.sao_viet_members add column if not exists gap_gold numeric default 0;
alter table public.sao_viet_members add column if not exists gap_platinum numeric default 0;
alter table public.sao_viet_members add column if not exists gap_diamond numeric default 0;
alter table public.sao_viet_members add column if not exists current_tier text;
alter table public.sao_viet_members add column if not exists progress_percent numeric default 0;
alter table public.sao_viet_members add column if not exists next_tier text;
alter table public.sao_viet_members add column if not exists synced_at timestamptz default now();
alter table public.sao_viet_members add column if not exists created_at timestamptz default now();
alter table public.sao_viet_members add column if not exists updated_at timestamptz default now();

create table if not exists public.import_logs (
  id uuid primary key default gen_random_uuid(),
  import_type text not null,
  source_name text,
  status text not null default 'success',
  message text,
  total_rows integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists sao_viet_members_revenue_idx
on public.sao_viet_members (total_revenue desc);

create index if not exists sao_viet_members_tier_idx
on public.sao_viet_members (current_tier);

drop trigger if exists sao_viet_settings_set_updated_at on public.sao_viet_settings;
create trigger sao_viet_settings_set_updated_at
before update on public.sao_viet_settings
for each row execute function public.set_updated_at();

drop trigger if exists sao_viet_members_set_updated_at on public.sao_viet_members;
create trigger sao_viet_members_set_updated_at
before update on public.sao_viet_members
for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sao_viet_members'
  ) then
    alter publication supabase_realtime add table public.sao_viet_members;
  end if;
end $$;

alter table public.sao_viet_settings enable row level security;
alter table public.sao_viet_members enable row level security;
alter table public.import_logs enable row level security;

drop policy if exists "Public read sao viet settings" on public.sao_viet_settings;
create policy "Public read sao viet settings" on public.sao_viet_settings for select using (true);
drop policy if exists "Public write sao viet settings" on public.sao_viet_settings;
create policy "Public write sao viet settings" on public.sao_viet_settings for all using (true) with check (true);

drop policy if exists "Public read sao viet members" on public.sao_viet_members;
create policy "Public read sao viet members" on public.sao_viet_members for select using (true);
drop policy if exists "Public write sao viet members" on public.sao_viet_members;
create policy "Public write sao viet members" on public.sao_viet_members for all using (true) with check (true);

drop policy if exists "Public read import logs" on public.import_logs;
create policy "Public read import logs" on public.import_logs for select using (true);
drop policy if exists "Public write import logs" on public.import_logs;
create policy "Public write import logs" on public.import_logs for all using (true) with check (true);
