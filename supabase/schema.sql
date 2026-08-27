-- IT ANT Poslovanje: initial database schema
create extension if not exists pgcrypto;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  pib text,
  mb text,
  address text,
  invoice_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoice_counters (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  invoice_year integer not null,
  last_number integer not null default 0,
  primary key (user_id, invoice_year)
);

create or replace function public.next_invoice_number()
returns text language plpgsql security invoker as $$
declare current_year integer := extract(year from current_date)::integer; next_number integer;
begin
  insert into public.invoice_counters (user_id, invoice_year, last_number) values (auth.uid(), current_year, 1)
  on conflict (user_id, invoice_year) do update set last_number = invoice_counters.last_number + 1
  returning last_number into next_number;
  return 'R-' || lpad(next_number::text, 3, '0') || '-' || right(current_year::text, 2);
end;
$$;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  number text not null,
  client_id uuid not null references public.clients(id) on delete restrict,
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  notes text,
  total numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, number)
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_total numeric(14,2) generated always as (quantity * unit_price) stored
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  description text,
  amount numeric(14,2) not null check (amount >= 0),
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;
alter table public.invoice_counters enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.expenses enable row level security;

create policy "Users manage their clients" on public.clients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their invoice counters" on public.invoice_counters for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their invoices" on public.invoices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their invoice items" on public.invoice_items for all using (exists (select 1 from public.invoices where invoices.id = invoice_items.invoice_id and invoices.user_id = auth.uid())) with check (exists (select 1 from public.invoices where invoices.id = invoice_items.invoice_id and invoices.user_id = auth.uid()));
create policy "Users manage their expenses" on public.expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
