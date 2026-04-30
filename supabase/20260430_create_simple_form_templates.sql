create extension if not exists pgcrypto;

drop table if exists public.form_documents cascade;
drop table if exists public.form_categories cascade;

delete from storage.objects where bucket_id = 'form-documents';
delete from storage.buckets where id = 'form-documents';

create table if not exists public.form_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('health_supplement', 'contract_issue', 'contract_management')),
  file_url text not null,
  file_path text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists form_templates_category_active_idx
on public.form_templates (category, is_active, updated_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists form_templates_set_updated_at on public.form_templates;
create trigger form_templates_set_updated_at
before update on public.form_templates
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('form-templates', 'form-templates', true, 52428800, array['application/pdf'])
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = array['application/pdf'];

alter table public.form_templates enable row level security;

drop policy if exists "Public read active form templates" on public.form_templates;
create policy "Public read active form templates"
on public.form_templates for select
using (is_active = true);

drop policy if exists "Public manage form templates" on public.form_templates;
create policy "Public manage form templates"
on public.form_templates for all
using (true)
with check (true);

drop policy if exists "Public read form template files" on storage.objects;
create policy "Public read form template files"
on storage.objects for select
using (bucket_id = 'form-templates');

drop policy if exists "Public upload form template files" on storage.objects;
create policy "Public upload form template files"
on storage.objects for insert
with check (bucket_id = 'form-templates' and lower(right(name, 4)) = '.pdf');

drop policy if exists "Public update form template files" on storage.objects;
create policy "Public update form template files"
on storage.objects for update
using (bucket_id = 'form-templates')
with check (bucket_id = 'form-templates' and lower(right(name, 4)) = '.pdf');

drop policy if exists "Public delete form template files" on storage.objects;
create policy "Public delete form template files"
on storage.objects for delete
using (bucket_id = 'form-templates');
