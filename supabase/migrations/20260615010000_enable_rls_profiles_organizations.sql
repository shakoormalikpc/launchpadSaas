-- Fix CRITICAL security advisor warnings: profiles and organizations have RLS
-- policies defined but RLS was never ENABLED, so the policies aren't enforced
-- (the tables are effectively open to anyone with the anon key).
--
-- profiles already has complete owner-scoped policies (view/insert/update own),
-- so enabling RLS is sufficient there.
--
-- organizations only had SELECT policies, but the client also INSERTs an org at
-- admin signup and UPDATEs the org name from the admin dashboard. We add those
-- two owner-scoped policies before enabling RLS so the app keeps working.
-- (Stripe edge functions use the service-role key and bypass RLS.)

-- ── profiles ────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ── organizations ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can create their own organization" ON public.organizations;
CREATE POLICY "Admins can create their own organization"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (admin_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update their own organization" ON public.organizations;
CREATE POLICY "Admins can update their own organization"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
