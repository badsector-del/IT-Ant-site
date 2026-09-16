-- Run once after multitenant-migration.sql.
-- The selected company is stored in trusted auth app_metadata.

create or replace function public.user_company_id()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  selected_company uuid;
begin
  selected_company := nullif(auth.jwt() -> 'app_metadata' ->> 'active_company_id', '')::uuid;
  if selected_company is not null and exists (
    select 1 from public.company_users
    where user_id = auth.uid() and company_id = selected_company
  ) then
    return selected_company;
  end if;
  return (
    select company_id from public.company_users
    where user_id = auth.uid()
    order by created_at
    limit 1
  );
end;
$$;
