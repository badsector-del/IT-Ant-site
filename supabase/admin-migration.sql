-- Run once after multitenant-migration.sql.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
drop policy if exists "Admins can see their admin record" on public.platform_admins;
create policy "Admins can see their admin record" on public.platform_admins
  for select using (user_id = auth.uid());

-- Replace the email only if the administrator email is different.
insert into public.platform_admins (user_id)
select id from auth.users where email = 'marko.novakovic@live.com'
on conflict (user_id) do nothing;

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;
drop policy if exists "Admins can see audit logs" on public.admin_audit_logs;
create policy "Admins can see audit logs" on public.admin_audit_logs
  for select using (exists (select 1 from public.platform_admins where user_id = auth.uid()));

alter table public.companies add column if not exists tax_regime text default 'pausal';
alter table public.companies add column if not exists vat_number text;
alter table public.companies add column if not exists regime_effective_from date default current_date;
update public.companies set tax_regime = 'pausal' where tax_regime is null;
alter table public.companies alter column tax_regime set not null;
alter table public.companies alter column regime_effective_from set not null;
do $$ begin
  alter table public.companies add constraint companies_tax_regime_check check (tax_regime in ('pausal', 'books_non_vat', 'books_vat'));
exception when duplicate_object then null;
end $$;
