-- IT ANT Poslovanje: ugovori po aktivnom preduzecu.
-- Pokrenuti jednom u Supabase SQL Editor-u.

create table if not exists public.contract_counters (
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_year integer not null,
  last_number integer not null default 0,
  primary key (company_id, contract_year)
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  number text not null,
  signature_date date not null default current_date,
  duration_type text not null default 'indefinite' check (duration_type in ('indefinite', 'definite')),
  end_date date,
  status text not null default 'active' check (status in ('potential', 'active', 'closed')),
  billing_type text not null default 'fixed' check (billing_type in ('fixed', 'variable')),
  monthly_subtotal numeric(14,2) not null default 0 check (monthly_subtotal >= 0),
  vat_rate numeric(5,2) not null default 0 check (vat_rate >= 0),
  vat_amount numeric(14,2) not null default 0 check (vat_amount >= 0),
  monthly_total numeric(14,2) not null default 0 check (monthly_total >= 0),
  tax_regime text not null default 'pausal' check (tax_regime in ('pausal', 'books_non_vat', 'books_vat')),
  item_prefix text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, number),
  check (duration_type = 'indefinite' or end_date is not null),
  check (tax_regime <> 'books_vat' or vat_rate >= 0)
);

create table if not exists public.contract_billing_plan (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  billing_year integer not null,
  billing_month integer not null check (billing_month between 1 and 12),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  vat_rate numeric(5,2) not null default 0 check (vat_rate >= 0),
  vat_amount numeric(14,2) not null default 0 check (vat_amount >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  unique (contract_id, billing_year, billing_month)
);

create or replace function public.next_contract_number()
returns text language plpgsql security invoker as $$
declare
  current_year integer := extract(year from current_date)::integer;
  next_number integer;
  current_company uuid := public.user_company_id();
begin
  if current_company is null then
    raise exception 'Korisnik nije povezan sa preduzecem';
  end if;
  insert into public.contract_counters (company_id, contract_year, last_number)
  values (current_company, current_year, 1)
  on conflict (company_id, contract_year)
  do update set last_number = contract_counters.last_number + 1
  returning last_number into next_number;
  return 'U-' || lpad(next_number::text, 3, '0') || '-' || right(current_year::text, 2);
end;
$$;

alter table public.contract_counters enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_billing_plan enable row level security;

drop policy if exists "Members manage contract counters" on public.contract_counters;
drop policy if exists "Members manage contracts" on public.contracts;
drop policy if exists "Members manage contract billing plans" on public.contract_billing_plan;

create policy "Members manage contract counters" on public.contract_counters for all
  using (company_id = public.user_company_id())
  with check (company_id = public.user_company_id());
create policy "Members manage contracts" on public.contracts for all
  using (company_id = public.user_company_id())
  with check (company_id = public.user_company_id());
create policy "Members manage contract billing plans" on public.contract_billing_plan for all
  using (exists (select 1 from public.contracts where contracts.id = contract_billing_plan.contract_id and contracts.company_id = public.user_company_id()))
  with check (exists (select 1 from public.contracts where contracts.id = contract_billing_plan.contract_id and contracts.company_id = public.user_company_id()));

create index if not exists idx_contracts_company_status on public.contracts(company_id, status);
create index if not exists idx_contracts_client on public.contracts(client_id);
create index if not exists idx_contracts_signature_date on public.contracts(signature_date);
