-- Run once after invoice-tax-migration.sql.
alter table public.companies add column if not exists mb text;
alter table public.companies add column if not exists activity_code text;
alter table public.companies add column if not exists responsible_person text;

alter table public.invoices add column if not exists turnover_date date;
update public.invoices set turnover_date = issue_date where turnover_date is null;
