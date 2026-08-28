-- Run once after admin-migration.sql. Existing invoices remain unchanged.
alter table public.invoices add column if not exists tax_regime text default 'pausal';
alter table public.invoices add column if not exists subtotal numeric(14,2) default 0;
alter table public.invoices add column if not exists vat_rate numeric(5,2) default 0;
alter table public.invoices add column if not exists vat_amount numeric(14,2) default 0;
alter table public.invoices add column if not exists updated_at timestamptz not null default now();
alter table public.invoices add column if not exists cancelled_at timestamptz;
update public.invoices set subtotal = total where subtotal is null or subtotal = 0;
update public.invoices set tax_regime = 'pausal' where tax_regime is null;
update public.invoices set vat_amount = 0 where vat_amount is null;
alter table public.invoices alter column tax_regime set not null;
alter table public.invoices alter column subtotal set not null;
alter table public.invoices alter column vat_rate set not null;
alter table public.invoices alter column vat_amount set not null;
do $$ begin
  alter table public.invoices add constraint invoices_tax_regime_check check (tax_regime in ('pausal', 'books_non_vat', 'books_vat'));
exception when duplicate_object then null;
end $$;
