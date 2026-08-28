-- Run once after admin-migration.sql. Existing invoices remain unchanged.
alter table public.invoices add column if not exists tax_regime text default 'pausal';
alter table public.invoices add column if not exists subtotal numeric(14,2) default 0;
alter table public.invoices add column if not exists vat_rate numeric(5,2) default 0;
alter table public.invoices add column if not exists vat_amount numeric(14,2) default 0;
alter table public.invoices add column if not exists updated_at timestamptz not null default now();
alter table public.invoices add column if not exists cancelled_at timestamptz;
alter table public.invoice_items add column if not exists vat_rate numeric(5,2) default 0;
alter table public.invoice_items add column if not exists vat_treatment text default 'taxable';
alter table public.invoice_items add column if not exists vat_amount numeric(14,2) default 0;
update public.invoices set subtotal = total where subtotal is null or subtotal = 0;
update public.invoices set tax_regime = 'pausal' where tax_regime is null;
update public.invoices set vat_amount = 0 where vat_amount is null;
update public.invoice_items set vat_rate = 0 where vat_rate is null;
update public.invoice_items set vat_treatment = 'taxable' where vat_treatment is null;
update public.invoice_items set vat_amount = 0 where vat_amount is null;
update public.invoice_items item
set vat_rate = invoice.vat_rate,
    vat_amount = round(item.quantity * item.unit_price * invoice.vat_rate / 100, 2)
from public.invoices invoice
where invoice.id = item.invoice_id
  and item.vat_treatment = 'taxable'
  and item.vat_rate = 0
  and invoice.vat_rate > 0;
alter table public.invoices alter column tax_regime set not null;
alter table public.invoices alter column subtotal set not null;
alter table public.invoices alter column vat_rate set not null;
alter table public.invoices alter column vat_amount set not null;
alter table public.invoice_items alter column vat_rate set not null;
alter table public.invoice_items alter column vat_treatment set not null;
alter table public.invoice_items alter column vat_amount set not null;
do $$ begin
  alter table public.invoices add constraint invoices_tax_regime_check check (tax_regime in ('pausal', 'books_non_vat', 'books_vat'));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.invoice_items add constraint invoice_items_vat_treatment_check check (vat_treatment in ('taxable', 'exempt_right', 'exempt_no'));
exception when duplicate_object then null;
end $$;
