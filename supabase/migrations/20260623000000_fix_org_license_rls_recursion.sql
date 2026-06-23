-- Fix infinite recursion (42P17) between organizations and licenses RLS policies.
--
-- "organizations → Students can read their org" sub-selected from licenses, and
-- "licenses → Admins can manage their licenses" sub-selected from organizations.
-- With RLS enforced on both tables, each policy triggered the other's RLS,
-- producing infinite recursion. Result: ANY authenticated read of organizations
-- failed ("Failed to load organization data" → 0 seats on the admin dashboard),
-- and admins could not insert licenses to invite students.
--
-- Fix: move the cross-table membership lookups into SECURITY DEFINER helper
-- functions that run as the owner and therefore bypass RLS, breaking the cycle.
-- The access logic is otherwise unchanged.

create or replace function public.admin_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.organizations where admin_id = auth.uid();
$$;

create or replace function public.student_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.licenses where student_email = auth.email();
$$;

grant execute on function public.admin_org_ids() to authenticated, anon;
grant execute on function public.student_org_ids() to authenticated, anon;

-- organizations: a student can read any org they hold a license in
drop policy if exists "Students can read their org" on public.organizations;
create policy "Students can read their org"
  on public.organizations
  for select
  to authenticated
  using (id in (select public.student_org_ids()));

-- licenses: an admin can manage licenses for orgs they administer
drop policy if exists "Admins can manage their licenses" on public.licenses;
create policy "Admins can manage their licenses"
  on public.licenses
  for all
  to authenticated
  using (org_id in (select public.admin_org_ids()))
  with check (org_id in (select public.admin_org_ids()));
