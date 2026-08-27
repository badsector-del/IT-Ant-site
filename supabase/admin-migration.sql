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
