-- IT ANT Poslovanje: ponude za aktivno preduzece.
-- Pokrenuti jednom u Supabase SQL Editor-u.

create table if not exists public.offer_counters (
  company_id uuid not null references public.companies(id) on delete cascade,
  offer_year integer not null,
  last_number integer not null default 0,
  primary key (company_id, offer_year)
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  invoice_id uuid references public.invoices(id) on delete set null,
  number text not null,
  issue_date date not null default current_date,
  valid_until date not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  payment_terms text,
  delivery_terms text,
  notes text,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  vat_rate numeric(5,2) not null default 0 check (vat_rate >= 0),
  vat_amount numeric(14,2) not null default 0 check (vat_amount >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  tax_regime text not null default 'pausal' check (tax_regime in ('pausal', 'books_non_vat', 'books_vat')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, number)
);

create table if not exists public.offer_items (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit text not null default 'kom',
  unit_price numeric(14,2) not null check (unit_price >= 0),
  vat_rate numeric(5,2) not null default 0 check (vat_rate >= 0),
  vat_treatment text not null default 'taxable' check (vat_treatment in ('taxable', 'exempt_right', 'exempt_no')),
  vat_amount numeric(14,2) not null default 0 check (vat_amount >= 0),
  line_total numeric(14,2) generated always as (quantity * unit_price + vat_amount) stored
);

alter table public.offers add column if not exists invoice_id uuid references public.invoices(id) on delete set null;

create or replace function public.next_offer_number()
returns text language plpgsql security invoker as $$
declare
  current_year integer := extract(year from current_date)::integer;
  next_number integer;
  current_company uuid := public.user_company_id();
begin
  if current_company is null then
    raise exception 'Korisnik nije povezan sa preduzecem';
  end if;

  insert into public.offer_counters (company_id, offer_year, last_number)
  values (current_company, current_year, 1)
  on conflict (company_id, offer_year)
  do update set last_number = offer_counters.last_number + 1
  returning last_number into next_number;

  return 'P-' || lpad(next_number::text, 3, '0') || '-' || right(current_year::text, 2);
end;
$$;

alter table public.offer_counters enable row level security;
alter table public.offers enable row level security;
alter table public.offer_items enable row level security;

drop policy if exists "Members manage company offer counters" on public.offer_counters;
drop policy if exists "Members manage company offers" on public.offers;
drop policy if exists "Members manage company offer items" on public.offer_items;

create policy "Members manage company offer counters"
  on public.offer_counters for all
  using (company_id = public.user_company_id())
  with check (company_id = public.user_company_id());

create policy "Members manage company offers"
  on public.offers for all
  using (company_id = public.user_company_id())
  with check (company_id = public.user_company_id());

create policy "Members manage company offer items"
  on public.offer_items for all
  using (exists (
    select 1 from public.offers
    where offers.id = offer_items.offer_id
      and offers.company_id = public.user_company_id()
  ))
  with check (exists (
    select 1 from public.offers
    where offers.id = offer_items.offer_id
      and offers.company_id = public.user_company_id()
  ));
