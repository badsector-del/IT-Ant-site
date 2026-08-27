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
