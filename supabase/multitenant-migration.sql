-- IT ANT Poslovanje: migrate existing user data to company-based tenancy.
-- Run once in Supabase SQL Editor. This migration preserves existing rows.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pib text,
  created_at timestamptz not null default now()
);

create table if not exists public.company_users (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

-- Give every existing user a private company before adding the required key.
insert into public.companies (name)
select 'Preduzeće korisnika ' || left(id::text, 8)
from auth.users
where not exists (
  select 1 from public.company_users cu where cu.user_id = auth.users.id
);

insert into public.company_users (company_id, user_id, role)
select c.id, u.id, 'owner'
from auth.users u
join public.companies c on c.name = 'Preduzeće korisnika ' || left(u.id::text, 8)
where not exists (
  select 1 from public.company_users cu where cu.user_id = u.id
);

alter table public.clients add column if not exists company_id uuid references public.companies(id);
alter table public.invoice_counters add column if not exists company_id uuid references public.companies(id);
alter table public.invoices add column if not exists company_id uuid references public.companies(id);
alter table public.expenses add column if not exists company_id uuid references public.companies(id);

update public.clients c set company_id = cu.company_id
from public.company_users cu where cu.user_id = c.user_id and c.company_id is null;
update public.invoice_counters c set company_id = cu.company_id
from public.company_users cu where cu.user_id = c.user_id and c.company_id is null;
update public.invoices i set company_id = cu.company_id
from public.company_users cu where cu.user_id = i.user_id and i.company_id is null;
update public.expenses e set company_id = cu.company_id
from public.company_users cu where cu.user_id = e.user_id and e.company_id is null;

alter table public.clients alter column company_id set not null;
alter table public.invoice_counters alter column company_id set not null;
alter table public.invoices alter column company_id set not null;
alter table public.expenses alter column company_id set not null;

alter table public.invoice_counters drop constraint if exists invoice_counters_pkey;
alter table public.invoice_counters add primary key (company_id, invoice_year);
alter table public.invoices drop constraint if exists invoices_user_id_number_key;
alter table public.invoices add constraint invoices_company_id_number_key unique (company_id, number);

create or replace function public.user_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.company_users where user_id = auth.uid() order by created_at limit 1
$$;

create or replace function public.next_invoice_number()
returns text language plpgsql security invoker as $$
declare current_year integer := extract(year from current_date)::integer;
  next_number integer;
  current_company uuid := public.user_company_id();
begin
  if current_company is null then raise exception 'Korisnik nije povezan sa preduzećem'; end if;
  insert into public.invoice_counters (user_id, company_id, invoice_year, last_number)
  values (auth.uid(), current_company, current_year, 1)
  on conflict (company_id, invoice_year) do update set last_number = invoice_counters.last_number + 1
  returning last_number into next_number;
  return 'R-' || lpad(next_number::text, 3, '0') || '-' || right(current_year::text, 2);
end;
$$;

alter table public.companies enable row level security;
alter table public.company_users enable row level security;
drop policy if exists "Users see their companies" on public.companies;
drop policy if exists "Users see their memberships" on public.company_users;
create policy "Users see their companies" on public.companies for select using (exists (select 1 from public.company_users cu where cu.company_id = companies.id and cu.user_id = auth.uid()));
create policy "Users see their memberships" on public.company_users for select using (user_id = auth.uid());

drop policy if exists "Users manage their clients" on public.clients;
drop policy if exists "Users manage their invoice counters" on public.invoice_counters;
drop policy if exists "Users manage their invoices" on public.invoices;
drop policy if exists "Users manage their invoice items" on public.invoice_items;
drop policy if exists "Users manage their expenses" on public.expenses;

create policy "Members manage company clients" on public.clients for all using (company_id = public.user_company_id()) with check (company_id = public.user_company_id());
create policy "Members manage company counters" on public.invoice_counters for all using (company_id = public.user_company_id()) with check (company_id = public.user_company_id());
create policy "Members manage company invoices" on public.invoices for all using (company_id = public.user_company_id()) with check (company_id = public.user_company_id());
create policy "Members manage company invoice items" on public.invoice_items for all using (exists (select 1 from public.invoices where invoices.id = invoice_items.invoice_id and invoices.company_id = public.user_company_id())) with check (exists (select 1 from public.invoices where invoices.id = invoice_items.invoice_id and invoices.company_id = public.user_company_id()));
create policy "Members manage company expenses" on public.expenses for all using (company_id = public.user_company_id()) with check (company_id = public.user_company_id());

