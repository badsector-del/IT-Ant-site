-- Run once after the multitenant migration.
alter table public.expenses add column if not exists supplier text;
alter table public.expenses add column if not exists invoice_number text;
alter table public.expenses add column if not exists subtotal numeric(14,2);
alter table public.expenses add column if not exists vat_rate numeric(5,2) not null default 0;
alter table public.expenses add column if not exists vat_amount numeric(14,2) not null default 0;
alter table public.expenses add column if not exists status text not null default 'paid';

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
