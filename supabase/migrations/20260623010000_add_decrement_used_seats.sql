-- Counterpart to increment_used_seats: returns a seat to the org's pool when an
-- admin removes/revokes a student's license. Mirrors increment_used_seats
-- (plpgsql, NOT security definer) so the existing RLS UPDATE policy on
-- organizations (admin_id = auth.uid()) governs who may call it. GREATEST guards
-- against ever going below zero.
CREATE OR REPLACE FUNCTION public.decrement_used_seats(org_id_param uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE organizations
  SET used_seats = GREATEST(used_seats - 1, 0)
  WHERE id = org_id_param;
END;
$function$;
