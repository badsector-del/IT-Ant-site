-- Run once after the multitenant migration.
alter table public.expenses add column if not exists supplier text;
alter table public.expenses add column if not exists supplier_id uuid references public.clients(id);
alter table public.expenses add column if not exists invoice_number text;
alter table public.expenses add column if not exists subtotal numeric(14,2);
alter table public.expenses add column if not exists vat_rate numeric(5,2) not null default 0;
alter table public.expenses add column if not exists vat_amount numeric(14,2) not null default 0;
alter table public.expenses add column if not exists status text not null default 'paid';

update public.expenses e
set supplier_id = c.id
from public.clients c
where e.supplier_id is null
  and e.company_id = c.company_id
  and e.supplier = c.name;

update public.expenses set subtotal = amount where subtotal is null;
alter table public.expenses alter column subtotal set not null;

do $$ begin
  alter table public.expenses add constraint expenses_status_check check (status in ('paid', 'pending'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.expenses add constraint expenses_vat_rate_check check (vat_rate in (0, 10, 20));
exception when duplicate_object then null;
end $$;

create table if not exists public.expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  vat_rate numeric(5,2) not null default 0 check (vat_rate in (0, 10, 20)),
  vat_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.expense_items enable row level security;
drop policy if exists "Members manage company expense items" on public.expense_items;
create policy "Members manage company expense items" on public.expense_items
for all using (exists (select 1 from public.expenses where expenses.id = expense_items.expense_id and expenses.company_id = public.user_company_id()))
with check (exists (select 1 from public.expenses where expenses.id = expense_items.expense_id and expenses.company_id = public.user_company_id()));
